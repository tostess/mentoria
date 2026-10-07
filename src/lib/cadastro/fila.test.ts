import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { identidade, inRollback, operadora } from "@/lib/db/cenario-de-teste";
import {
  DIAS_ATE_ANONIMIZAR,
  EmailNaoConfirmado,
  PedidoJaDecidido,
  PedidoSemLogin,
  anonimizacaoNaTransacao,
  aprovacaoNaTransacao,
  loginsDeRecusados,
  pedidoNaTransacao,
  recusaNaTransacao,
  type DadosDoPedido,
} from "./operacoes";

/**
 * O cadastro self-service (A3) contra o Postgres de verdade: o pedido, a
 * aprovação que vira conta pessoal, a recusa e a anonimização de 90 dias.
 *
 * Mesmo desenho das outras suítes de banco: as funções são as que a aplicação
 * chama, tudo numa transação que sofre rollback, e a suíte se pula sozinha sem
 * `DIRECT_URL`. O login vem de `identidade()`, que nasce sem e-mail confirmado
 * — como o do `signUp`.
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

type Login = { userId: string; email: string };

async function login(tx: postgres.TransactionSql, confirmado: boolean): Promise<Login> {
  const userId = await identidade(tx, "cad");
  if (confirmado) await tx`update auth.users set email_confirmed_at = now() where id = ${userId}`;
  const [{ email }] = await tx<{ email: string }[]>`select email from auth.users where id = ${userId}`;
  return { userId, email };
}

function dados(email: string, extra: Partial<DadosDoPedido> = {}): DadosDoPedido {
  return {
    nome: "Joana Ribeiro",
    email,
    telefone: "(11) 98765-4321",
    cargo: "Enfermeira",
    area: "Saúde",
    linkedin: "https://linkedin.com/in/joana",
    objetivo: "Liderança no plantão.",
    versaoDosTermos: "2026-10",
    ...extra,
  };
}

async function pedido(tx: postgres.TransactionSql, confirmado = true) {
  const quem = await login(tx, confirmado);
  const { id } = await pedidoNaTransacao(tx, quem.userId, dados(quem.email));
  return { id, ...quem };
}

async function hook(tx: postgres.TransactionSql, userId: string) {
  const evento = JSON.stringify({ user_id: userId, claims: { sub: userId } });
  const [{ out }] = await tx<{ out: { claims: Record<string, unknown> } }[]>`
    select public.custom_access_token_hook(${evento}::text::jsonb) as out`;
  return out.claims;
}

run("cadastro — o pedido", () => {
  it("grava o pedido pendente com o login de quem pediu", async () => {
    await emRollback(async (tx) => {
      const p = await pedido(tx);
      const [linha] = await tx`
        select user_id, status, name, goal, terms_version from individual_signups where id = ${p.id}`;
      expect(linha).toMatchObject({
        user_id: p.userId,
        status: "pending",
        name: "Joana Ribeiro",
        goal: "Liderança no plantão.",
        terms_version: "2026-10",
      });
    });
  });

  it("o segundo envio antes da decisão atualiza o pedido, sem abrir outro na fila", async () => {
    await emRollback(async (tx) => {
      const quem = await login(tx, false);
      const primeiro = await pedidoNaTransacao(tx, quem.userId, dados(quem.email));
      const [{ created_at: antes }] = await tx`select created_at from individual_signups where id = ${primeiro.id}`;

      const segundo = await pedidoNaTransacao(
        tx,
        quem.userId,
        dados(quem.email.toUpperCase(), { objetivo: "Agora é sobre carreira." }),
      );

      expect(segundo.id).toBe(primeiro.id);
      const linhas = await tx`
        select goal, created_at from individual_signups where lower(email) = lower(${quem.email})`;
      expect(linhas).toHaveLength(1);
      expect(linhas[0].goal).toBe("Agora é sobre carreira.");
      expect(linhas[0].created_at).toEqual(antes);
    });
  });

  it("sem perfil, o token não ganha papel — toda policy nega até a aprovação", async () => {
    await emRollback(async (tx) => {
      const p = await pedido(tx);
      const claims = await hook(tx, p.userId);
      expect(claims.user_role).toBeUndefined();
      expect(claims.org_id).toBeUndefined();
    });
  });
});

run("cadastro — a aprovação", () => {
  it("vira conta pessoal com o login do pedido, e o token ganha papel", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);

      const { userId, orgId, nome } = await aprovacaoNaTransacao(tx, p.id, adm);
      expect(userId).toBe(p.userId);
      expect(nome).toBe("Joana Ribeiro");

      const [perfil] = await tx`
        select p.role, p.email, p.org_id, o.kind, w.balance, ow.balance as contrato
          from profiles p
          join orgs o on o.id = p.org_id
          join wallets w on w.user_id = p.id
          join org_wallets ow on ow.org_id = o.id
         where p.id = ${userId}`;
      expect(perfil).toMatchObject({
        role: "professional",
        email: p.email,
        org_id: orgId,
        kind: "individual",
        balance: 0,
        contrato: 0,
      });

      const [decisao] = await tx`
        select status, decided_by, decided_at from individual_signups where id = ${p.id}`;
      expect(decisao.status).toBe("approved");
      expect(decisao.decided_by).toBe(adm.id);
      expect(decisao.decided_at).not.toBeNull();

      const claims = await hook(tx, userId);
      expect(claims).toMatchObject({ user_role: "professional", org_id: orgId, org_kind: "individual" });
    });
  });

  it("audita como aprovação de cadastro, numa linha só", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);
      await aprovacaoNaTransacao(tx, p.id, adm);

      const linhas = await tx`
        select action, actor_id, entity_id from audit_logs where entity_id = ${p.userId}`;
      expect(linhas).toEqual([{ action: "aprovar_cadastro", actor_id: adm.id, entity_id: p.userId }]);
    });
  });

  it("recusa e-mail sem confirmar, sem mexer em nada", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx, false);

      const falha = await esperandoFalha(tx, (sp) => aprovacaoNaTransacao(sp, p.id, adm));
      expect(falha).toBeInstanceOf(EmailNaoConfirmado);

      const [{ status }] = await tx`select status from individual_signups where id = ${p.id}`;
      expect(status).toBe("pending");
      const perfis = await tx`select 1 from profiles where id = ${p.userId}`;
      expect(perfis).toHaveLength(0);
    });
  });

  it("não aprova duas vezes", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);
      await aprovacaoNaTransacao(tx, p.id, adm);

      const falha = await esperandoFalha(tx, (sp) => aprovacaoNaTransacao(sp, p.id, adm));
      expect(falha).toBeInstanceOf(PedidoJaDecidido);
    });
  });

  it("pedido cujo login sumiu não vira conta", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);
      await tx`update individual_signups set user_id = null where id = ${p.id}`;

      const falha = await esperandoFalha(tx, (sp) => aprovacaoNaTransacao(sp, p.id, adm));
      expect(falha).toBeInstanceOf(PedidoSemLogin);
    });
  });
});

run("cadastro — a recusa", () => {
  it("marca a decisão com o motivo interno e devolve o login a apagar", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);

      const { userId, nome } = await recusaNaTransacao(tx, p.id, adm, "pedido em nome de empresa");
      expect(userId).toBe(p.userId);
      expect(nome).toBe("Joana Ribeiro");

      const [linha] = await tx`
        select status, reject_reason, decided_by from individual_signups where id = ${p.id}`;
      expect(linha).toEqual({
        status: "rejected",
        reject_reason: "pedido em nome de empresa",
        decided_by: adm.id,
      });
    });
  });

  it("a auditoria não leva nome, e-mail nem motivo — sobrevive à anonimização", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);
      await recusaNaTransacao(tx, p.id, adm, "motivo interno");

      const [linha] = await tx`
        select action, entity, before, after from audit_logs where entity_id = ${p.id}`;
      expect(linha).toEqual({
        action: "recusar_cadastro",
        entity: "individual_signups",
        before: null,
        after: null,
      });
    });
  });

  it("pedido recusado não é aprovado depois, nem recusado de novo", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const p = await pedido(tx);
      await recusaNaTransacao(tx, p.id, adm, null);

      expect(await esperandoFalha(tx, (sp) => aprovacaoNaTransacao(sp, p.id, adm))).toBeInstanceOf(
        PedidoJaDecidido,
      );
      expect(await esperandoFalha(tx, (sp) => recusaNaTransacao(sp, p.id, adm, null))).toBeInstanceOf(
        PedidoJaDecidido,
      );
    });
  });

  it("a rede da rodada diária acha o login que a recusa não apagou — e só ele", async () => {
    await emRollback(async (tx) => {
      const adm = await operadora(tx);
      const recusado = await pedido(tx);
      const aprovado = await pedido(tx);
      const pendente = await pedido(tx);
      await recusaNaTransacao(tx, recusado.id, adm, null);
      await aprovacaoNaTransacao(tx, aprovado.id, adm);

      const logins = await loginsDeRecusados(tx);
      expect(logins).toContain(recusado.userId);
      expect(logins).not.toContain(aprovado.userId);
      expect(logins).not.toContain(pendente.userId);

      // Apagar o login anula o vínculo pela FK, e ele sai da lista.
      await tx`delete from auth.users where id = ${recusado.userId}`;
      const [{ user_id }] = await tx`select user_id from individual_signups where id = ${recusado.id}`;
      expect(user_id).toBeNull();
      expect(await loginsDeRecusados(tx)).not.toContain(recusado.userId);
    });
  });
});

run("cadastro — anonimização de 90 dias", () => {
  const DIA = 24 * 60 * 60 * 1000;

  async function recusadoHa(tx: postgres.TransactionSql, dias: number, agora: Date) {
    const adm = await operadora(tx);
    const p = await pedido(tx);
    await recusaNaTransacao(tx, p.id, adm, "motivo interno");
    const quando = new Date(agora.getTime() - dias * DIA).toISOString();
    await tx`update individual_signups set decided_at = ${quando}::text::timestamptz where id = ${p.id}`;
    return p;
  }

  it(`anonimiza o recusado há mais de ${DIAS_ATE_ANONIMIZAR} dias e deixa o resto`, async () => {
    await emRollback(async (tx) => {
      const agora = new Date();
      // Pedidos de outras suítes ou do dev não podem mudar a conta deste teste.
      await anonimizacaoNaTransacao(tx, agora);

      const velho = await recusadoHa(tx, DIAS_ATE_ANONIMIZAR + 1, agora);
      const novo = await recusadoHa(tx, DIAS_ATE_ANONIMIZAR - 1, agora);
      const adm = await operadora(tx);
      const aprovado = await pedido(tx);
      await aprovacaoNaTransacao(tx, aprovado.id, adm);
      await tx`update individual_signups set decided_at = now() - interval '200 days' where id = ${aprovado.id}`;

      expect(await anonimizacaoNaTransacao(tx, agora)).toBe(1);

      const [anon] = await tx`
        select name, email, phone, job_title, area, linkedin, goal, reject_reason, anonymized_at, status
          from individual_signups where id = ${velho.id}`;
      expect(anon).toMatchObject({
        name: "Pedido anonimizado",
        email: `anonimizado-${velho.id}@anonimizado.invalid`,
        phone: null,
        job_title: null,
        area: null,
        linkedin: null,
        goal: null,
        reject_reason: null,
        status: "rejected",
      });
      expect(anon.anonymized_at).not.toBeNull();

      const intactos = await tx`
        select name from individual_signups where id in (${novo.id}, ${aprovado.id})`;
      expect(intactos.map((l) => l.name)).toEqual(["Joana Ribeiro", "Joana Ribeiro"]);
    });
  });

  it("é idempotente e audita a rodada sem autor, só com a contagem", async () => {
    await emRollback(async (tx) => {
      const agora = new Date();
      await anonimizacaoNaTransacao(tx, agora);
      await recusadoHa(tx, DIAS_ATE_ANONIMIZAR + 5, agora);

      expect(await anonimizacaoNaTransacao(tx, agora)).toBe(1);
      expect(await anonimizacaoNaTransacao(tx, agora)).toBe(0);

      const auditorias = await tx`
        select actor_id, after from audit_logs
         where action = 'anonimizar_cadastros' and created_at = now()`;
      expect(auditorias).toContainEqual({ actor_id: null, after: { quantidade: 1 } });
    });
  });

  it("o banco recusa anonimizar pedido que não foi recusado", async () => {
    await emRollback(async (tx) => {
      const p = await pedido(tx);
      const falha = await esperandoFalha(
        tx,
        (sp) => sp`update individual_signups set anonymized_at = now() where id = ${p.id}`,
      );
      expect(String(falha)).toMatch(/individual_signups_anon_rejected/);
    });
  });
});
