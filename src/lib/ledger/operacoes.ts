import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import type { Role } from "@/lib/auth/claims";
import { TetoDaCarteira } from "./erros";
import { chaveAlocacaoManual, chaveCompra } from "./keys";

/**
 * O movimento da ficha, escrito dentro de uma transação que já existe.
 *
 * Estas funções recebem a transação em vez de abri-la, e é isso que as torna
 * testáveis: o teste abre uma transação, chama a mesma função que a aplicação
 * chama, e desfaz tudo no fim. Se o SQL vivesse no módulo que chama
 * `getSql()`, o teste teria de reescrever o SQL — e passaria a testar a cópia
 * em vez do original.
 *
 * Sem `server-only`: não lê segredo e não abre conexão. Quem faz as duas
 * coisas é `ledger/index.ts`.
 *
 * Nenhuma função aqui escreve `balance` nem `balance_after`. Quem soma é o
 * trigger (invariante 3); o zero passado no insert é ignorado e sobrescrito.
 */

export type Ator = { id: string; role: Role };

export type Compra = {
  orgId: string;
  fichas: number;
  referencia: string | null;
  /** Sorteado quando o formulário é montado — invariante 16. */
  token: string;
  ator: Ator;
};

/**
 * `purchase` no livro-caixa da empresa, mais o tamanho do contrato.
 *
 * `orgs.contracted_fichas` sobe na mesma transação porque são dois números
 * diferentes: ele é o tamanho do contrato e `org_wallets.balance` é o que
 * sobrou dele, que desce a cada alocação. Atualizar um fora da transação
 * deixaria o contrato dizer 120 e o livro-caixa dizer 240.
 */
export async function compraNaTransacao(
  tx: postgres.TransactionSql,
  compra: Compra,
): Promise<{ saldo: number; contratadas: number }> {
  const [lancamento] = await tx<{ balance_after: number }[]>`
    insert into org_ledger (org_id, type, amount, balance_after, by_user_id, reason, idempotency_key)
    values (${compra.orgId}, 'purchase', ${compra.fichas}, 0,
            ${compra.ator.id}, ${compra.referencia}, ${chaveCompra(compra.orgId, compra.token)})
    returning balance_after`;

  const [org] = await tx<{ contracted_fichas: number }[]>`
    update orgs
       set contracted_fichas = contracted_fichas + ${compra.fichas}
     where id = ${compra.orgId}
    returning contracted_fichas`;

  if (!org) throw new Error(`empresa inexistente: ${compra.orgId}`);

  await registrarAuditoria(tx, {
    ator: compra.ator,
    orgId: compra.orgId,
    acao: "registrar_compra",
    entidade: "org_ledger",
    depois: {
      fichas: compra.fichas,
      referencia: compra.referencia,
      saldo_depois: lancamento.balance_after,
      contratadas_depois: org.contracted_fichas,
    },
  });

  return { saldo: lancamento.balance_after, contratadas: org.contracted_fichas };
}

export type Alocacao = {
  orgId: string;
  userId: string;
  quantidade: number;
  /** Teto por carteira, de `app_config.ficha_policy.max_balance`. */
  tetoCarteira: number;
  token: string;
  ator: Ator;
};

/**
 * Invariante 6: `allocate` negativo no `org_ledger` e positivo no
 * `wallet_ledger`, na mesma transação. A ficha sai do contrato e entra na
 * carteira, ou nada acontece.
 */
export async function alocacaoNaTransacao(
  tx: postgres.TransactionSql,
  alocacao: Alocacao,
): Promise<{ saldoContrato: number; saldoCarteira: number }> {
  await travarCarteira(tx, alocacao);

  const [naEmpresa] = await tx<{ balance_after: number }[]>`
    insert into org_ledger (org_id, type, amount, balance_after, to_user_id, by_user_id, idempotency_key)
    values (${alocacao.orgId}, 'allocate', ${-alocacao.quantidade}, 0,
            ${alocacao.userId}, ${alocacao.ator.id},
            ${chaveAlocacaoManual(alocacao.userId, alocacao.token)})
    returning balance_after`;

  // Mesma chave nos dois livros, de propósito: as constraints são de tabelas
  // diferentes, então não colidem entre si, e as duas metades da alocação
  // passam a ser rastreáveis por um valor só.
  const [naCarteira] = await tx<{ balance_after: number }[]>`
    insert into wallet_ledger (user_id, org_id, type, amount, balance_after, by_user_id, idempotency_key)
    values (${alocacao.userId}, ${alocacao.orgId}, 'allocate', ${alocacao.quantidade}, 0,
            ${alocacao.ator.id}, ${chaveAlocacaoManual(alocacao.userId, alocacao.token)})
    returning balance_after`;

  await registrarAuditoria(tx, {
    ator: alocacao.ator,
    orgId: alocacao.orgId,
    acao: "alocar_fichas",
    entidade: "wallet_ledger",
    entidadeId: alocacao.userId,
    depois: {
      quantidade: alocacao.quantidade,
      saldo_contrato_depois: naEmpresa.balance_after,
      saldo_carteira_depois: naCarteira.balance_after,
    },
  });

  return {
    saldoContrato: naEmpresa.balance_after,
    saldoCarteira: naCarteira.balance_after,
  };
}

/**
 * Trava a carteira e confere o teto.
 *
 * O teto por carteira é conferido aqui e não por constraint porque ele vive em
 * `app_config` e muda por empresa — o banco não tem como saber o número. Para
 * a checagem não perder a corrida, a linha é travada com `for update` antes da
 * leitura: duas alocações simultâneas para a mesma pessoa passam a ser
 * sequenciais, e a segunda vê o saldo que a primeira deixou.
 */
async function travarCarteira(
  tx: postgres.TransactionSql,
  alocacao: Alocacao,
): Promise<void> {
  const [carteira] = await tx<{ balance: number; org_id: string }[]>`
    select balance, org_id from wallets where user_id = ${alocacao.userId} for update`;

  // Quem cria o Profissional cria a carteira na mesma transação, então
  // carteira ausente é dado corrompido, não caso de uso.
  if (!carteira) {
    throw new Error(`carteira inexistente: ${alocacao.userId}`);
  }

  // A empresa vem da tela; a carteira diz a verdade. Divergência é tentativa
  // de mover ficha entre empresas (invariante 13), e não passa.
  if (carteira.org_id !== alocacao.orgId) {
    throw new Error(`carteira de outra empresa: ${alocacao.userId}`);
  }

  if (carteira.balance + alocacao.quantidade > alocacao.tetoCarteira) {
    const cabe = alocacao.tetoCarteira - carteira.balance;
    throw new TetoDaCarteira(
      cabe <= 0
        ? `A carteira já está no teto de ${alocacao.tetoCarteira}.`
        : `Cabem no máximo ${cabe} — o teto por carteira é ${alocacao.tetoCarteira}.`,
    );
  }
}
