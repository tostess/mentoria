import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { reservaNaTransacao } from "@/lib/bookings/operacoes";
import {
  comprarPacote,
  contaPessoal,
  darFichas,
  empresa,
  identidade,
  inRollback,
  operadora,
  pacote,
  parceiroComRotina,
  profissional,
  token,
} from "@/lib/db/cenario-de-teste";
import type { Limites } from "@/lib/scheduling";
import { compraManualNaTransacao, creditoNaTransacao } from "./credito";
import { TipoDeContaErrado, ehChaveRepetida } from "./erros";
import { chaveAlocacaoManual } from "./keys";
import { lotesDaCarteira } from "./lotes";
import { alocacaoNaTransacao, compraNaTransacao, estornoNaTransacao } from "./operacoes";

/**
 * A conta pessoal do avulso (A1), contra o Postgres de verdade.
 *
 * Mesmo desenho das outras suítes de banco: as funções chamadas são as da
 * aplicação, tudo dentro de uma transação que sofre rollback, e a suíte se pula
 * sozinha sem `DIRECT_URL`.
 */

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;
const emRollback = <T,>(fn: (tx: postgres.TransactionSql) => Promise<T>) => inRollback(db!, fn);

/** Falha esperada sem envenenar a transação do teste. */
function esperandoFalha<T>(
  tx: postgres.TransactionSql,
  fn: (sp: postgres.TransactionSql) => Promise<T>,
): Promise<unknown> {
  return tx
    .savepoint(async (sp) => {
      await fn(sp);
      return null;
    })
    .then(() => null)
    .catch((falha: unknown) => falha);
}

function mensagem(falha: unknown): string {
  return falha instanceof Error ? falha.message : String(falha);
}

run("conta pessoal — a org de um só", () => {
  it("nasce individual, com carteira do contrato, perfil e carteira", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId, orgId } = await contaPessoal(tx, ator, "Joana Avulsa");
      const [org] = await tx<{ kind: string; name: string; cnpj: string | null }[]>`
        select kind::text, name, cnpj from orgs where id = ${orgId}`;
      const [contrato] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;
      const [perfil] = await tx<{ role: string; org_id: string }[]>`
        select role::text, org_id from profiles where id = ${userId}`;
      const [carteira] = await tx<{ balance: number; org_id: string }[]>`
        select balance, org_id from wallets where user_id = ${userId}`;
      const [auditoria] = await tx<{ action: string }[]>`
        select action from audit_logs where entity_id = ${userId}`;
      return { orgId, org, contrato, perfil, carteira, auditoria };
    });

    expect(lido.org).toEqual({ kind: "individual", name: "Joana Avulsa", cnpj: null });
    expect(lido.contrato.balance).toBe(0);
    expect(lido.perfil).toEqual({ role: "professional", org_id: lido.orgId });
    expect(lido.carteira).toEqual({ balance: 0, org_id: lido.orgId });
    expect(lido.auditoria.action).toBe("criar_conta_pessoal");
  });

  it("recusa um segundo perfil na mesma conta pessoal", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { orgId } = await contaPessoal(tx, ator);
      const intruso = await identidade(tx, "int");
      return esperandoFalha(
        tx,
        (sp) => sp`
          insert into profiles (id, org_id, role, name, email)
          values (${intruso}, ${orgId}, 'professional', 'Intruso', 'int@teste.local')`,
      );
    });
    expect(mensagem(falha)).toMatch(/conta pessoal já tem dono/);
  });

  it("recusa RH dentro de conta pessoal", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const [org] = await tx<{ id: string }[]>`
        insert into orgs (kind, name) values ('individual', 'Sem dono') returning id`;
      const rh = await identidade(tx, "rh");
      return esperandoFalha(
        tx,
        (sp) => sp`
          insert into profiles (id, org_id, role, name, email)
          values (${rh}, ${org.id}, 'org_admin', 'RH', ${`rh-${ator.id}@teste.local`})`,
      );
    });
    expect(mensagem(falha)).toMatch(/só tem Profissional/);
  });

  it("o tipo da conta não muda depois de criada", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      return esperandoFalha(tx, (sp) => sp`update orgs set kind = 'individual' where id = ${orgId}`);
    });
    expect(mensagem(falha)).toMatch(/tipo da conta não muda/);
  });

  it("CPF é único entre contas pessoais e não existe em empresa", async () => {
    const falhas = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const a = await contaPessoal(tx, ator, "A");
      const b = await contaPessoal(tx, ator, "B");
      const orgId = await empresa(tx, ator);
      await tx`update orgs set cpf = '52998224725' where id = ${a.orgId}`;
      const repetido = await esperandoFalha(
        tx,
        (sp) => sp`update orgs set cpf = '52998224725' where id = ${b.orgId}`,
      );
      const emEmpresa = await esperandoFalha(
        tx,
        (sp) => sp`update orgs set cpf = '11144477735' where id = ${orgId}`,
      );
      return { repetido, emEmpresa };
    });
    expect(ehChaveRepetida(falhas.repetido)).toBe(true);
    expect(mensagem(falhas.emEmpresa)).toMatch(/orgs_cpf_so_individual/);
  });
});

run("conta pessoal — o crédito do pacote", () => {
  it("credita o pacote com lote de 12 meses, passando pelo contrato dela", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId, orgId } = await contaPessoal(tx, ator);
      const credito = await comprarPacote(tx, { userId, ator, fichas: 4 });

      const [pagamento] = await tx<
        { status: string; amount_cents: number; provider: string; meses: number }[]
      >`
        select p.status, p.amount_cents, p.provider,
               (extract(year from age(l.expires_at, p.paid_at)) * 12
                + extract(month from age(l.expires_at, p.paid_at)))::int as meses
          from payments p join ficha_lots l on l.payment_id = p.id
         where p.id = ${credito.paymentId}`;
      const contrato = await tx<{ type: string; amount: number; idempotency_key: string }[]>`
        select type::text, amount, idempotency_key from org_ledger
         where org_id = ${orgId} order by amount desc`;
      const [org] = await tx<{ contracted_fichas: number }[]>`
        select contracted_fichas from orgs where id = ${orgId}`;
      const [saldoContrato] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;
      const [carteira] = await tx<{ type: string; amount: number; lot_id: string }[]>`
        select type::text, amount, lot_id from wallet_ledger where user_id = ${userId}`;
      const lotes = await lotesDaCarteira(tx, userId);
      const [auditoria] = await tx<{ action: string }[]>`
        select action from audit_logs
         where entity_id = ${userId} and action = 'registrar_compra_pessoal'`;

      return { credito, pagamento, contrato, org, saldoContrato, carteira, lotes, auditoria };
    });

    expect(lido.credito.jaCreditado).toBe(false);
    expect(lido.credito.saldoCarteira).toBe(4);
    expect(lido.pagamento).toEqual({
      status: "confirmed",
      amount_cents: 10_000,
      provider: "manual",
      meses: 12,
    });
    expect(lido.contrato.map((l) => [l.type, l.amount])).toEqual([
      ["purchase", 4],
      ["allocate", -4],
    ]);
    expect(lido.contrato[0].idempotency_key).toBe(`pay_${lido.credito.paymentId}`);
    expect(lido.contrato[1].idempotency_key).toBe(`payalloc_${lido.credito.paymentId}`);
    expect(lido.org.contracted_fichas).toBe(4);
    expect(lido.saldoContrato.balance).toBe(0);
    expect(lido.carteira).toEqual({ type: "allocate", amount: 4, lot_id: lido.credito.lotId });
    expect(lido.lotes).toHaveLength(1);
    expect(lido.lotes[0]).toMatchObject({ fichas: 4, restante: 4 });
    expect(lido.auditoria.action).toBe("registrar_compra_pessoal");
  });

  /** Pagou por 8, recebe 8: o teto de 6 é da alocação do RH, não da compra. */
  it("ignora o teto da carteira", async () => {
    const saldo = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId } = await contaPessoal(tx, ator);
      await comprarPacote(tx, { userId, ator, fichas: 8 });
      const credito = await comprarPacote(tx, { userId, ator, fichas: 4 });
      return credito.saldoCarteira;
    });
    expect(saldo).toBe(12);
  });

  it("creditar de novo o mesmo pagamento não lança nada", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId } = await contaPessoal(tx, ator);
      const primeiro = await comprarPacote(tx, { userId, ator, fichas: 4 });
      const segundo = await creditoNaTransacao(tx, {
        paymentId: primeiro.paymentId,
        validadeMeses: 12,
        motivo: "Pacote Teste",
        ator: null,
      });
      const [linhas] = await tx<{ n: number }[]>`
        select count(*)::int as n from wallet_ledger where user_id = ${userId}`;
      return { primeiro, segundo, linhas: linhas.n };
    });

    expect(lido.segundo.jaCreditado).toBe(true);
    expect(lido.segundo.lotId).toBe(lido.primeiro.lotId);
    expect(lido.segundo.saldoCarteira).toBe(4);
    expect(lido.linhas).toBe(1);
  });

  it("o mesmo formulário enviado duas vezes colide", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId } = await contaPessoal(tx, ator);
      const mesmo = token();
      const compra = {
        userId,
        pacote: pacote(1),
        validadeMeses: 12,
        referencia: null,
        token: mesmo,
        ator,
      };
      await compraManualNaTransacao(tx, compra);
      return esperandoFalha(tx, (sp) => compraManualNaTransacao(sp, compra));
    });
    expect(ehChaveRepetida(falha)).toBe(true);
  });

  it("pagamento estornado não é creditado", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId, orgId } = await contaPessoal(tx, ator);
      const [pagamento] = await tx<{ id: string }[]>`
        insert into payments (user_id, org_id, package_id, fichas, amount_cents, provider, status)
        values (${userId}, ${orgId}, 'ritmo', 4, 44900, 'asaas', 'refunded')
        returning id`;
      return esperandoFalha(tx, (sp) =>
        creditoNaTransacao(sp, {
          paymentId: pagamento.id,
          validadeMeses: 12,
          motivo: "Pacote Ritmo",
          ator: null,
        }),
      );
    });
    expect(mensagem(falha)).toMatch(/refunded/);
  });
});

run("conta pessoal — os canais não se misturam", () => {
  it("pacote não se registra para colaborador de empresa", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      return esperandoFalha(tx, (sp) => comprarPacote(sp, { userId, ator, fichas: 1 }));
    });
    expect(falha).toBeInstanceOf(TipoDeContaErrado);
  });

  it("conta pessoal não recebe contrato nem alocação", async () => {
    const falhas = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId, orgId } = await contaPessoal(tx, ator);
      const contrato = await esperandoFalha(tx, (sp) =>
        compraNaTransacao(sp, { orgId, fichas: 10, referencia: null, token: token(), ator }),
      );
      const alocacao = await esperandoFalha(tx, (sp) =>
        alocacaoNaTransacao(sp, {
          orgId,
          userId,
          quantidade: 1,
          tetoCarteira: 6,
          chave: chaveAlocacaoManual(userId, token()),
          ator,
        }),
      );
      return { contrato, alocacao };
    });
    expect(falhas.contrato).toBeInstanceOf(TipoDeContaErrado);
    expect(falhas.alocacao).toBeInstanceOf(TipoDeContaErrado);
  });
});

const AGORA = new Date("2026-09-25T12:00:00Z");
const TERCA_9H = new Date("2026-09-29T12:00:00Z");
const TERCA_10H = new Date("2026-09-29T13:00:00Z");
const LIMITES: Limites = { horizonteDias: 14, avisoMinimoHoras: 12, duracaoMin: 30, passoMin: 30 };
const ROTINA = [{ diaDaSemana: 2 as const, inicioMin: 540, fimMin: 720 }];

function pedido(
  base: { orgId: string; partnerId: string; userId: string },
  inicio: Date = TERCA_9H,
) {
  return {
    bookingId: crypto.randomUUID(),
    orgId: base.orgId,
    partnerId: base.partnerId,
    professionalId: base.userId,
    inicio,
    agora: AGORA,
    limites: LIMITES,
    precoFichas: 1,
    maxPendentes: 2,
  };
}

/** Restante de cada lote, pelo id. */
async function restantes(tx: postgres.TransactionSql, userId: string) {
  const lotes = await lotesDaCarteira(tx, userId);
  return Object.fromEntries(lotes.map((l) => [l.id, l.restante]));
}

run("conta pessoal — a ficha sai do lote que vence primeiro", () => {
  it("o gasto marca o lote mais próximo de vencer", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const conta = await contaPessoal(tx, ator);
      const partnerId = await parceiroComRotina(tx, ator, { regras: ROTINA });
      const longo = await comprarPacote(tx, { userId: conta.userId, ator, fichas: 2 });
      const curto = await comprarPacote(tx, {
        userId: conta.userId,
        ator,
        fichas: 2,
        validadeMeses: 6,
      });

      const reserva = pedido({ ...conta, partnerId });
      await reservaNaTransacao(tx, reserva);
      const [gasto] = await tx<{ lot_id: string }[]>`
        select lot_id from wallet_ledger where booking_id = ${reserva.bookingId}`;
      return { gasto, curto: curto.lotId, longo: longo.lotId, restantes: await restantes(tx, conta.userId) };
    });

    expect(lido.gasto.lot_id).toBe(lido.curto);
    expect(lido.restantes[lido.curto]).toBe(1);
    expect(lido.restantes[lido.longo]).toBe(2);
  });

  it("o estorno devolve a ficha ao lote de onde ela saiu", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const conta = await contaPessoal(tx, ator);
      const partnerId = await parceiroComRotina(tx, ator, { regras: ROTINA });
      const compra = await comprarPacote(tx, { userId: conta.userId, ator, fichas: 1 });

      const reserva = pedido({ ...conta, partnerId });
      await reservaNaTransacao(tx, reserva);
      const depoisDoGasto = await restantes(tx, conta.userId);
      await estornoNaTransacao(tx, { bookingId: reserva.bookingId, ator: null, motivo: "Recusa" });
      const [estorno] = await tx<{ lot_id: string | null }[]>`
        select lot_id from wallet_ledger
         where booking_id = ${reserva.bookingId} and type = 'refund'`;
      return { lote: compra.lotId, depoisDoGasto, estorno, final: await restantes(tx, conta.userId) };
    });

    expect(lido.depoisDoGasto[lido.lote]).toBe(0);
    expect(lido.estorno.lot_id).toBe(lido.lote);
    expect(lido.final[lido.lote]).toBe(1);
  });

  /**
   * Lote vencido ainda não baixado vale até a baixa rodar — e o gasto o usa
   * primeiro. Se a sessão for estornada depois do vencimento, a ficha volta sem
   * lote: não vence mais, porque a pessoa não perde por um prazo que correu com
   * a ficha presa no pedido.
   */
  it("o estorno de ficha de lote vencido volta sem validade", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const conta = await contaPessoal(tx, ator);
      const partnerId = await parceiroComRotina(tx, ator, { regras: ROTINA });
      const vencido = await comprarPacote(tx, {
        userId: conta.userId,
        ator,
        fichas: 1,
        validadeMeses: -1,
      });

      const reserva = pedido({ ...conta, partnerId });
      await reservaNaTransacao(tx, reserva);
      const [gasto] = await tx<{ lot_id: string | null }[]>`
        select lot_id from wallet_ledger where booking_id = ${reserva.bookingId}`;
      await estornoNaTransacao(tx, { bookingId: reserva.bookingId, ator: null, motivo: "Recusa" });
      const [estorno] = await tx<{ lot_id: string | null }[]>`
        select lot_id from wallet_ledger
         where booking_id = ${reserva.bookingId} and type = 'refund'`;
      return { vencido: vencido.lotId, gasto, estorno };
    });

    expect(lido.gasto.lot_id).toBe(lido.vencido);
    expect(lido.estorno.lot_id).toBeNull();
  });

  it("na carteira de empresa o gasto não tem lote", async () => {
    const lote = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      const partnerId = await parceiroComRotina(tx, ator, { regras: ROTINA });
      await darFichas(tx, { orgId, userId, ator, contrato: 10, naCarteira: 2 });
      const reserva = pedido({ orgId, userId, partnerId }, TERCA_10H);
      await reservaNaTransacao(tx, reserva);
      const [gasto] = await tx<{ lot_id: string | null }[]>`
        select lot_id from wallet_ledger where booking_id = ${reserva.bookingId}`;
      return gasto.lot_id;
    });
    expect(lote).toBeNull();
  });

  it("lançamento não aponta para lote de outra pessoa", async () => {
    const falha = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const dona = await contaPessoal(tx, ator, "Dona");
      const outra = await contaPessoal(tx, ator, "Outra");
      const compra = await comprarPacote(tx, { userId: dona.userId, ator, fichas: 1 });
      return esperandoFalha(
        tx,
        (sp) => sp`
          insert into wallet_ledger (user_id, org_id, type, amount, balance_after, lot_id,
                                     idempotency_key)
          values (${outra.userId}, ${outra.orgId}, 'adjust', 1, 0, ${compra.lotId},
                  ${`adjust_teste_${token()}`})`,
      );
    });
    expect(mensagem(falha)).toMatch(/wallet_ledger_lot_fk/);
  });
});
