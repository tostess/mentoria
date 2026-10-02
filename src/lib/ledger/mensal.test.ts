import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { DEFAULT_FICHA_POLICY, type FichaPolicy } from "@/lib/config/app-config";
import {
  comprarPacote,
  contaPessoal,
  darFichas,
  empresa,
  inRollback,
  operadora,
  profissional,
} from "@/lib/db/cenario-de-teste";
import { acessoDaTransacao, quantoAlocar, recargaNaConexao } from "./mensal";

/**
 * A recarga do dia 1º, contra o Postgres de verdade.
 *
 * A rodada abre uma transação por pessoa. Aqui ela recebe `acessoDaTransacao`, e
 * cada uma dessas transações vira um savepoint dentro da transação do teste — que
 * sofre rollback no fim. É o que permite exercitar uma rodada inteira sem deixar
 * lançamento no banco, apesar de o livro-caixa ser append-only.
 *
 * `agora` é sempre parâmetro: **2026-10-01T09:00:00Z**, o instante em que o cron
 * dispara. Em São Paulo é 6h do dia 1º, então o período é `202610`.
 */

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;
const emRollback = <T,>(fn: (tx: postgres.TransactionSql) => Promise<T>) => inRollback(db!, fn);

const AGORA = new Date("2026-10-01T09:00:00Z");
const POLICY: FichaPolicy = { ...DEFAULT_FICHA_POLICY, defaultAllocationPerUser: 2, maxBalance: 6 };

function rodar(tx: postgres.TransactionSql, fichaPolicy: FichaPolicy = POLICY) {
  return recargaNaConexao(acessoDaTransacao(tx), { agora: AGORA, fichaPolicy });
}

/** A empresa desta rodada, entre as que o banco de teste já tiver. */
function daEmpresa(resultado: Awaited<ReturnType<typeof rodar>>, orgId: string) {
  const achada = resultado.empresas.find((e) => e.orgId === orgId);
  if (achada === undefined) throw new Error(`empresa ${orgId} não apareceu na rodada`);
  return achada;
}

describe("quantoAlocar", () => {
  const policy = { defaultAllocationPerUser: 2, maxBalance: 6 };

  it("soma o valor do mês quando cabe", () => {
    expect(quantoAlocar(0, 100, policy)).toBe(2);
    expect(quantoAlocar(4, 100, policy)).toBe(2);
  });

  /**
   * A decisão que este teste trava: quem está com 5 recebe 1, não zero. Fichas
   * acumulam, e o teto não é motivo para deixar ficha na mesa.
   */
  it("aloca parcialmente quando só cabe uma parte", () => {
    expect(quantoAlocar(5, 100, policy)).toBe(1);
  });

  it("não aloca nada no teto", () => {
    expect(quantoAlocar(6, 100, policy)).toBe(0);
    expect(quantoAlocar(7, 100, policy)).toBe(0);
  });

  it("nunca passa do que o contrato tem", () => {
    expect(quantoAlocar(0, 1, policy)).toBe(1);
    expect(quantoAlocar(0, 0, policy)).toBe(0);
  });

  it("nunca devolve negativo", () => {
    expect(quantoAlocar(10, -5, policy)).toBe(0);
  });
});

run("recarga mensal", () => {
  it("dá o valor do mês a quem tem carteira", async () => {
    const resultado = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Recarga ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 0 });

      const rodada = await rodar(tx);
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;
      const [lancamento] = await tx<{ type: string; amount: number; by_user_id: string | null }[]>`
        select type::text, amount, by_user_id from wallet_ledger
         where user_id = ${userId} and idempotency_key like 'alloc_%'`;

      return { empresa: daEmpresa(rodada, orgId), saldo: carteira.balance, lancamento };
    });

    expect(resultado.empresa.pessoas).toBe(1);
    expect(resultado.empresa.fichas).toBe(2);
    expect(resultado.saldo).toBe(2);
    expect(resultado.lancamento.amount).toBe(2);
    // Trabalho agendado não tem autor: a coluna fica nula, não inventa usuário.
    expect(resultado.lancamento.by_user_id).toBeNull();
  });

  it("o período entra na chave — é o que torna a rodada idempotente", async () => {
    const chave = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Chave ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 0 });
      await rodar(tx);

      const [linha] = await tx<{ idempotency_key: string }[]>`
        select idempotency_key from wallet_ledger
         where user_id = ${userId} and idempotency_key like 'alloc_%'`;
      return linha.idempotency_key;
    });

    expect(chave).toMatch(/^alloc_[0-9a-f-]{36}_202610$/);
  });

  /** O caso que a invariante 16 existe para cobrir. */
  it("rodar duas vezes no mesmo mês não duplica", async () => {
    const resultado = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Duas vezes ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 0 });

      const primeira = await rodar(tx);
      const segunda = await rodar(tx);

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;
      const [quantos] = await tx<{ n: number }[]>`
        select count(*)::int as n from wallet_ledger
         where user_id = ${userId} and idempotency_key like 'alloc_%'`;

      return {
        primeira: daEmpresa(primeira, orgId),
        segunda: daEmpresa(segunda, orgId),
        saldo: carteira.balance,
        lancamentos: quantos.n,
      };
    });

    expect(resultado.primeira.pessoas).toBe(1);
    // A segunda não é falha: é "já recebeu".
    expect(resultado.segunda.pessoas).toBe(0);
    expect(resultado.segunda.jaFeitas).toBe(1);
    expect(resultado.segunda.erros).toEqual([]);
    expect(resultado.saldo).toBe(2);
    expect(resultado.lancamentos).toBe(1);
  });

  it("completa até o teto em vez de pular quem está quase cheio", async () => {
    const resultado = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Parcial ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 5 });

      const rodada = await rodar(tx);
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;
      return { empresa: daEmpresa(rodada, orgId), saldo: carteira.balance };
    });

    expect(resultado.empresa.fichas).toBe(1);
    expect(resultado.saldo).toBe(6);
  });

  it("pula quem já está no teto, e diz por quê", async () => {
    const resultado = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Teto ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 6 });

      const rodada = await rodar(tx);
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;
      return { empresa: daEmpresa(rodada, orgId), saldo: carteira.balance };
    });

    expect(resultado.empresa.pessoas).toBe(0);
    expect(resultado.empresa.noTeto).toBe(1);
    expect(resultado.empresa.erros).toEqual([]);
    expect(resultado.saldo).toBe(6);
  });

  /**
   * A razão de ser uma transação por pessoa: o contrato acabando no meio da lista
   * não pode derrubar quem já recebeu nem quem vem depois.
   */
  it("contrato que acaba no meio da lista não derruba a rodada", async () => {
    const resultado = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Curto ${Date.now()}`);
      // Três pessoas e contrato para uma e meia.
      const a = await profissional(tx, orgId, ator, "Aaa Primeira");
      const b = await profissional(tx, orgId, ator, "Bbb Segunda");
      const c = await profissional(tx, orgId, ator, "Ccc Terceira");
      await darFichas(tx, { orgId, userId: a, ator, contrato: 3, naCarteira: 0 });

      const rodada = await rodar(tx);
      const saldos = await tx<{ user_id: string; balance: number }[]>`
        select user_id, balance from wallets where user_id in (${a}, ${b}, ${c})`;
      const [contrato] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;

      return {
        empresa: daEmpresa(rodada, orgId),
        total: saldos.reduce((soma, s) => soma + s.balance, 0),
        contrato: contrato.balance,
      };
    });

    // 3 no contrato: 2 para a primeira, 1 para a segunda, nada para a terceira.
    expect(resultado.total).toBe(3);
    expect(resultado.contrato).toBe(0);
    expect(resultado.empresa.pessoas).toBe(2);
    expect(resultado.empresa.fichas).toBe(3);
    expect(resultado.empresa.semSaldo).toBe(1);
    expect(resultado.empresa.erros).toEqual([]);
  });

  it("não recarrega quem teve o acesso desativado", async () => {
    const resultado = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Inativo ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 0 });
      await tx`update profiles set active = false where id = ${userId}`;

      const rodada = await rodar(tx);
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;
      return { apareceu: rodada.empresas.some((e) => e.orgId === orgId), saldo: carteira.balance };
    });

    expect(resultado.apareceu).toBe(false);
    expect(resultado.saldo).toBe(0);
  });

  it("não recarrega empresa desativada", async () => {
    const apareceu = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Fechada ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 0 });
      await tx`update orgs set active = false where id = ${orgId}`;

      const rodada = await rodar(tx);
      return rodada.empresas.some((e) => e.orgId === orgId);
    });

    expect(apareceu).toBe(false);
  });

  it("grava auditoria sem autor, com o período (invariante 12)", async () => {
    const registro = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator, `Auditoria ${Date.now()}`);
      const userId = await profissional(tx, orgId, ator);
      await darFichas(tx, { orgId, userId, ator, contrato: 50, naCarteira: 0 });
      await rodar(tx);

      const [linha] = await tx<
        {
          action: string;
          actor_id: string | null;
          actor_role: string | null;
          after: Record<string, unknown>;
        }[]
      >`select action, actor_id, actor_role::text, after from audit_logs
          where org_id = ${orgId} and action = 'alocar_fichas_mensal'`;
      return linha;
    });

    expect(registro.action).toBe("alocar_fichas_mensal");
    // Cron não tem pessoa por trás; inventar um usuário de sistema faria o
    // histórico afirmar algo falso.
    expect(registro.actor_id).toBeNull();
    expect(registro.actor_role).toBeNull();
    expect(registro.after.periodo).toBe("202610");
    expect(registro.after.quantidade).toBe(2);
  });
});

run("recarga mensal — conta pessoal fica de fora", () => {
  /**
   * A recarga sai do contrato da empresa. A conta pessoal compra pacote e não
   * tem contrato: entrar na rodada seria tentar alocar de um saldo que é sempre
   * zero, e a rodada registraria "contrato acabou" para quem nunca teve um.
   */
  it("não aparece na rodada nem recebe lançamento", async () => {
    const lido = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const { userId, orgId } = await contaPessoal(tx, ator);
      await comprarPacote(tx, { userId, ator, fichas: 1 });

      const rodada = await rodar(tx);
      const [recargas] = await tx<{ n: number }[]>`
        select count(*)::int as n from wallet_ledger
         where user_id = ${userId} and idempotency_key like 'alloc_%'`;
      return { naRodada: rodada.empresas.some((e) => e.orgId === orgId), recargas: recargas.n };
    });

    expect(lido.naRodada).toBe(false);
    expect(lido.recargas).toBe(0);
  });
});
