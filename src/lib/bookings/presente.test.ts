import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  darFichas,
  empresa,
  inRollback,
  operadora,
  parceiroComRotina,
  profissional,
} from "@/lib/db/cenario-de-teste";
import { chavePresente } from "@/lib/ledger/keys";
import { presenteNaTransacao } from "@/lib/ledger/operacoes";
import type { Limites } from "@/lib/scheduling";
import { reservaNaTransacao } from "./operacoes";
import {
  MOTIVO_PRESENTE,
  PresenteRecusado,
  estadoDoPresente,
  periodoDoPresente,
  presenteNaSessao,
} from "./presente";
import { SessaoNaoEncontrada } from "./transicoes";

/**
 * O presente do Parceiro (invariante 20) contra o Postgres de verdade.
 *
 * Mesmo relógio de `transicoes.test.ts`: pedido na sexta 25/09 para terça 29/09,
 * 9h–9h30 em São Paulo (12:00Z–12:30Z). O Parceiro confirma sozinho, então a
 * sessão já nasce `confirmed`.
 */

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;
const emRollback = <T,>(fn: (tx: postgres.TransactionSql) => Promise<T>) => inRollback(db!, fn);

const PEDIDO_EM = new Date("2026-09-25T12:00:00Z");
const TERCA_9H = new Date("2026-09-29T12:00:00Z");
const MINUTO = 60_000;
const NA_SALA = new Date(TERCA_9H.getTime() + 20 * MINUTO);

const LIMITES: Limites = { horizonteDias: 14, avisoMinimoHoras: 12, duracaoMin: 30, passoMin: 30 };

async function cenario(
  tx: postgres.TransactionSql,
  opcoes: { autoConfirm?: boolean; naCarteira?: number } = {},
) {
  const ator = await operadora(tx);
  const orgId = await empresa(tx, ator);
  const professionalId = await profissional(tx, orgId, ator);
  const partnerId = await parceiroComRotina(tx, ator, {
    regras: [
      { diaDaSemana: 2, inicioMin: 540, fimMin: 720 },
      { diaDaSemana: 4, inicioMin: 540, fimMin: 720 },
    ],
    autoConfirm: opcoes.autoConfirm ?? true,
  });
  await darFichas(tx, { orgId, userId: professionalId, ator, contrato: 20, naCarteira: opcoes.naCarteira ?? 2 });

  const reservar = (inicio: Date) =>
    reservaNaTransacao(tx, {
      bookingId: crypto.randomUUID(),
      orgId,
      partnerId,
      professionalId,
      inicio,
      agora: PEDIDO_EM,
      limites: LIMITES,
      precoFichas: 1,
      maxPendentes: 2,
    });

  const { bookingId } = await reservar(TERCA_9H);
  return { ator, orgId, professionalId, partnerId, bookingId, reservar };
}

async function carteira(tx: postgres.TransactionSql, userId: string) {
  const [w] = await tx<{ balance: number }[]>`select balance from wallets where user_id = ${userId}`;
  return w.balance;
}

function falha<T>(tx: postgres.TransactionSql, fn: (sp: postgres.TransactionSql) => Promise<T>) {
  return tx
    .savepoint(async (sp) => {
      await fn(sp);
      return null;
    })
    .then(() => null)
    .catch((erro: unknown) => erro);
}

run("presentear dentro da sala", () => {
  it("dá 1 ficha a quem pagou a sessão e gasta 1 da cota do mês", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const antes = await carteira(tx, s.professionalId);
      const cota = await presenteNaSessao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      const [lancamento] = await tx<
        { type: string; amount: number; by_user_id: string; reason: string; org_id: string }[]
      >`select type::text, amount, by_user_id, reason, org_id from wallet_ledger
         where idempotency_key = ${chavePresente(s.bookingId)}`;
      return { s, antes, depois: await carteira(tx, s.professionalId), cota, lancamento };
    });

    expect(r.depois).toBe(r.antes + 1);
    expect(r.cota).toEqual({ cota: 3, usados: 1 });
    expect(r.lancamento).toEqual({
      type: "gift",
      amount: 1,
      by_user_id: r.s.partnerId,
      reason: MOTIVO_PRESENTE,
      org_id: r.s.orgId,
    });
  });

  it("não sai do contrato da empresa", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const [antes] = await tx<{ balance: number }[]>`select balance from org_wallets where org_id = ${s.orgId}`;
      await presenteNaSessao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      const [depois] = await tx<{ balance: number }[]>`select balance from org_wallets where org_id = ${s.orgId}`;
      return { antes: antes.balance, depois: depois.balance };
    });

    expect(r.depois).toBe(r.antes);
  });

  it("ignora o teto da carteira", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { naCarteira: 6 });
      // 6 alocadas, 1 gasta na reserva: volta ao teto com o presente, e passa com outro.
      await tx`update wallets set balance = balance where user_id = ${s.professionalId}`;
      const { bookingId: outra } = await s.reservar(new Date("2026-10-01T12:00:00Z"));
      await presenteNaSessao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      await presenteNaSessao(tx, {
        bookingId: outra,
        partnerId: s.partnerId,
        agora: new Date("2026-10-01T12:10:00Z"),
      });
      return carteira(tx, s.professionalId);
    });

    // 6 − 2 gastas + 2 presentes = 6; o que importa é que o segundo passou sem TetoDaCarteira.
    expect(r).toBe(6);
  });

  it("uma por sessão: o segundo pedido é recusado com frase, e a cota não é gasta duas vezes", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await presenteNaSessao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      const erro = await falha(tx, (sp) =>
        presenteNaSessao(sp, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA }),
      );
      const estado = await estadoDoPresente(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      return { erro, estado };
    });

    expect(r.erro).toBeInstanceOf(PresenteRecusado);
    expect((r.erro as PresenteRecusado).motivo).toBe("ja-presenteou");
    expect(r.estado).toEqual({ cota: 3, usados: 1, dadoNestaSessao: true });
  });

  it("a chave do livro-caixa é a segunda cerca do 'uma por sessão'", async () => {
    const erro = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await presenteNaTransacao(tx, { bookingId: s.bookingId, ator: { id: s.partnerId, role: "partner" }, motivo: "x" });
      return falha(tx, (sp) =>
        presenteNaTransacao(sp, { bookingId: s.bookingId, ator: { id: s.partnerId, role: "partner" }, motivo: "x" }),
      );
    });

    expect((erro as { code?: string }).code).toBe("23505");
  });

  it("cota esgotada recusa sem lançar nada", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await tx`update partners set gift_quota_monthly = 1 where id = ${s.partnerId}`;
      const { bookingId: outra } = await s.reservar(new Date("2026-09-29T13:00:00Z"));
      await presenteNaSessao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      const erro = await falha(tx, (sp) =>
        presenteNaSessao(sp, {
          bookingId: outra,
          partnerId: s.partnerId,
          agora: new Date("2026-09-29T13:10:00Z"),
        }),
      );
      const [n] = await tx<{ n: number }[]>`
        select count(*)::int as n from wallet_ledger where idempotency_key = ${chavePresente(outra)}`;
      return { erro, lancados: n.n };
    });

    expect((r.erro as PresenteRecusado).motivo).toBe("sem-cota");
    expect((r.erro as Error).message).toBe("Você já deu o presente deste mês.");
    expect(r.lancados).toBe(0);
  });

  it("a cota é do mês de São Paulo e não acumula", () => {
    // 01/10 às 2h UTC ainda é 30/09 em São Paulo.
    expect(periodoDoPresente(new Date("2026-10-01T02:00:00Z"))).toBe("202609");
    expect(periodoDoPresente(new Date("2026-10-01T03:00:00Z"))).toBe("202610");
  });

  it("só do início da sessão até a sala fechar (fim + 5)", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const tentar = (min: number) =>
        falha(tx, (sp) =>
          presenteNaSessao(sp, {
            bookingId: s.bookingId,
            partnerId: s.partnerId,
            agora: new Date(TERCA_9H.getTime() + min * MINUTO),
          }),
        );
      return { antes: await tentar(-1), depois: await tentar(35), noFim: await tentar(34) };
    });

    expect((r.antes as PresenteRecusado).motivo).toBe("fora-da-sala");
    expect((r.depois as PresenteRecusado).motivo).toBe("fora-da-sala");
    expect(r.noFim).toBeNull();
  });

  it("pedido que o Parceiro ainda não confirmou não recebe presente", async () => {
    const erro = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: false });
      return falha(tx, (sp) =>
        presenteNaSessao(sp, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA }),
      );
    });

    expect((erro as PresenteRecusado).motivo).toBe("nao-confirmada");
  });

  it("sessão de outro Parceiro responde como se não existisse", async () => {
    const erro = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const outro = await parceiroComRotina(tx, s.ator);
      return falha(tx, (sp) => presenteNaSessao(sp, { bookingId: s.bookingId, partnerId: outro, agora: NA_SALA }));
    });

    expect(erro).toBeInstanceOf(SessaoNaoEncontrada);
  });
});

run("utilização com presente e estorno (org_usage)", () => {
  it("presente entra em fichas_extra; usada é gasto menos estorno", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await presenteNaSessao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: NA_SALA });
      const [u] = await tx<
        { alocadas: number; gastas: number; usadas: number; extra: number }[]
      >`select sum(fichas_allocated)::int as alocadas, sum(fichas_spent)::int as gastas,
               sum(fichas_used)::int as usadas, sum(fichas_extra)::int as extra
          from org_usage where org_id = ${s.orgId}`;
      return u;
    });

    expect(r).toEqual({ alocadas: 2, gastas: 1, usadas: 1, extra: 1 });
  });
});
