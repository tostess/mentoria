import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import type { Pacote } from "@/lib/config/app-config";
import { PagamentoNaoCreditavel, TipoDeContaErrado } from "./erros";
import { chavePagamento, chavePagamentoAlocacao, idPagamentoManual } from "./keys";
import type { Ator } from "./operacoes";

/**
 * A ficha da conta pessoal: do pagamento confirmado à carteira.
 *
 * Invariante 13: o Profissional de empresa não compra ficha; o avulso compra
 * pacote, e a ficha comprada só nasce aqui — do pagamento que alguém confirmou.
 * Na A4 quem confirma é o gateway, relido na API; até lá, e como reserva se ele
 * faltar, é a operadora registrando um pagamento recebido fora da plataforma.
 * Os dois caminhos passam pela mesma função, como a alocação mensal e a manual
 * passam por `alocacaoNaTransacao`.
 *
 * Como `operacoes.ts`: recebe a transação, sem `server-only`, e é o que o teste
 * chama.
 */

export type Credito = {
  paymentId: string;
  /** De `app_config.individual_policy`. Contada do pagamento. */
  validadeMeses: number;
  /** Frase para o extrato — "Pacote Ritmo". Sem nome de ninguém. */
  motivo: string;
  /** A operadora no registro manual; nulo quando quem confirmou foi o gateway. */
  ator: Ator | null;
};

export type ResultadoDoCredito = {
  /** O pagamento já estava creditado: a segunda confirmação não lançou nada. */
  jaCreditado: boolean;
  lotId: string;
  saldoCarteira: number;
  venceEm: Date;
};

/**
 * Invariante 6 na conta pessoal: `purchase (+n)` e `allocate (−n)` no contrato
 * dela, `allocate (+n)` na carteira com o lote, numa transação. A ficha passa
 * pelo contrato, como na empresa, para o livro-caixa contar a mesma história
 * nos dois canais — e `contracted_fichas` vira o total comprado.
 *
 * **Idempotente.** O pagamento é travado `for update` e o status decide: já
 * `confirmed` devolve o crédito que existe sem lançar nada; `pending` credita;
 * qualquer outro recusa. As chaves `pay_` e `payalloc_` são a segunda cerca —
 * a que não depende de ninguém lembrar da primeira.
 *
 * **Não confere o teto da carteira.** O teto é da alocação do RH; quem pagou
 * por 8 fichas recebe 8, mesmo com o teto em 6.
 */
export async function creditoNaTransacao(
  tx: postgres.TransactionSql,
  credito: Credito,
): Promise<ResultadoDoCredito> {
  const [pagamento] = await tx<
    { user_id: string; org_id: string; fichas: number; status: string; tipo: string }[]
  >`
    select p.user_id, p.org_id, p.fichas, p.status, o.kind::text as tipo
      from payments p
      join orgs o on o.id = p.org_id
     where p.id = ${credito.paymentId}
       for update of p`;

  if (!pagamento) throw new Error(`pagamento inexistente: ${credito.paymentId}`);
  if (pagamento.tipo !== "individual") {
    throw new TipoDeContaErrado("Pagamento de pacote só existe em conta pessoal.");
  }

  if (pagamento.status === "confirmed") {
    return { jaCreditado: true, ...(await creditoExistente(tx, credito.paymentId)) };
  }
  if (pagamento.status !== "pending") {
    throw new PagamentoNaoCreditavel(`Este pagamento está como "${pagamento.status}".`);
  }

  // A carteira é travada antes de lançar, como na alocação e na reserva: a
  // conta pessoal pode estar reservando uma sessão no mesmo instante.
  const [carteira] = await tx<{ org_id: string }[]>`
    select org_id from wallets where user_id = ${pagamento.user_id} for update`;
  if (!carteira) throw new Error(`carteira inexistente: ${pagamento.user_id}`);
  if (carteira.org_id !== pagamento.org_id) {
    throw new Error(`carteira de outra conta: ${pagamento.user_id}`);
  }

  await tx`
    update payments
       set status = 'confirmed', paid_at = coalesce(paid_at, now())
     where id = ${credito.paymentId}`;

  await tx`
    insert into org_ledger (org_id, type, amount, balance_after, by_user_id, reason, idempotency_key)
    values (${pagamento.org_id}, 'purchase', ${pagamento.fichas}, 0, ${credito.ator?.id ?? null},
            ${credito.motivo}, ${chavePagamento(credito.paymentId)})`;

  await tx`
    update orgs set contracted_fichas = contracted_fichas + ${pagamento.fichas}
     where id = ${pagamento.org_id}`;

  await tx`
    insert into org_ledger (org_id, type, amount, balance_after, to_user_id, by_user_id,
                            idempotency_key)
    values (${pagamento.org_id}, 'allocate', ${-pagamento.fichas}, 0, ${pagamento.user_id},
            ${credito.ator?.id ?? null}, ${chavePagamentoAlocacao(credito.paymentId)})`;

  // A validade conta do pagamento, lida no próprio banco: o instante não passa
  // pela aplicação, onde um `Date` interpolado estoura no bundle do Next
  // (ver `db/instantes.ts`).
  const [lote] = await tx<{ id: string; expires_at: string }[]>`
    insert into ficha_lots (user_id, org_id, payment_id, fichas, expires_at)
    select ${pagamento.user_id}, ${pagamento.org_id}, p.id, ${pagamento.fichas},
           p.paid_at + make_interval(months => ${credito.validadeMeses}::int)
      from payments p
     where p.id = ${credito.paymentId}
    returning id, expires_at`;

  const [lancamento] = await tx<{ balance_after: number }[]>`
    insert into wallet_ledger (user_id, org_id, type, amount, balance_after, lot_id, by_user_id,
                               reason, idempotency_key)
    values (${pagamento.user_id}, ${pagamento.org_id}, 'allocate', ${pagamento.fichas}, 0,
            ${lote.id}, ${credito.ator?.id ?? null}, ${credito.motivo},
            ${chavePagamento(credito.paymentId)})
    returning balance_after`;

  return {
    jaCreditado: false,
    lotId: lote.id,
    saldoCarteira: lancamento.balance_after,
    venceEm: new Date(lote.expires_at),
  };
}

async function creditoExistente(
  tx: postgres.TransactionSql,
  paymentId: string,
): Promise<Omit<ResultadoDoCredito, "jaCreditado">> {
  const [linha] = await tx<{ id: string; expires_at: string; balance: number }[]>`
    select l.id, l.expires_at, w.balance
      from ficha_lots l
      join wallets w on w.user_id = l.user_id
     where l.payment_id = ${paymentId}`;
  if (!linha) throw new Error(`pagamento confirmado sem lote: ${paymentId}`);
  return { lotId: linha.id, saldoCarteira: linha.balance, venceEm: new Date(linha.expires_at) };
}

export type CompraManual = {
  /** O dono da conta pessoal. A conta vem do perfil dele, nunca de parâmetro. */
  userId: string;
  pacote: Pacote;
  validadeMeses: number;
  /** Texto livre da operadora: "Pix de 02/10", número do comprovante. */
  referencia: string | null;
  /** Sorteado quando o formulário é montado — invariante 16. */
  token: string;
  ator: Ator;
};

/**
 * A operadora registra um pacote pago fora da plataforma: o pagamento nasce
 * `manual` e é creditado na mesma transação, com auditoria (invariante 12).
 *
 * É o caminho do piloto enquanto o checkout não existe (A4) e a reserva se a
 * conta de produção do gateway atrasar. O preço gravado é o do pacote no
 * momento — a mesma regra do checkout.
 */
export async function compraManualNaTransacao(
  tx: postgres.TransactionSql,
  compra: CompraManual,
): Promise<ResultadoDoCredito & { paymentId: string }> {
  const [conta] = await tx<{ org_id: string | null; tipo: string | null }[]>`
    select p.org_id, o.kind::text as tipo
      from profiles p
      left join orgs o on o.id = p.org_id
     where p.id = ${compra.userId} and p.role = 'professional' and p.deleted_at is null`;

  if (!conta || conta.org_id === null || conta.tipo !== "individual") {
    throw new TipoDeContaErrado("Pacote só se registra para conta pessoal.");
  }

  const [pagamento] = await tx<{ id: string }[]>`
    insert into payments (user_id, org_id, package_id, fichas, amount_cents, provider,
                          provider_payment_id, status, reference, created_by)
    values (${compra.userId}, ${conta.org_id}, ${compra.pacote.id}, ${compra.pacote.fichas},
            ${compra.pacote.precoCentavos}, 'manual', ${idPagamentoManual(compra.token)},
            'pending', ${compra.referencia}, ${compra.ator.id})
    returning id`;

  const resultado = await creditoNaTransacao(tx, {
    paymentId: pagamento.id,
    validadeMeses: compra.validadeMeses,
    motivo: `Pacote ${compra.pacote.nome}`,
    ator: compra.ator,
  });

  await registrarAuditoria(tx, {
    ator: compra.ator,
    orgId: conta.org_id,
    acao: "registrar_compra_pessoal",
    entidade: "payments",
    entidadeId: compra.userId,
    depois: {
      pagamento: pagamento.id,
      pacote: compra.pacote.nome,
      fichas: compra.pacote.fichas,
      valor_centavos: compra.pacote.precoCentavos,
      referencia: compra.referencia,
      vence_em: resultado.venceEm.toISOString(),
      saldo_depois: resultado.saldoCarteira,
    },
  });

  return { ...resultado, paymentId: pagamento.id };
}
