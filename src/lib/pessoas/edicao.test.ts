import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  PessoaInexistente,
  TemSessaoFutura,
  TransicaoInvalida,
  acessoNaTransacao,
  diferenca,
  edicaoParceiroNaTransacao,
  edicaoProfissionalNaTransacao,
  parceiroParaEdicao,
  statusParceiroNaTransacao,
  type DadosDoParceiro,
} from "./edicao";
import { empresaNaTransacao, parceiroNaTransacao, profissionalNaTransacao } from "./operacoes";

/**
 * A edição de pessoas contra o Postgres de verdade, pelo mesmo caminho da
 * aplicação: as funções de `edicao.ts` recebem a transação, e o teste a
 * desfaz no fim. Mesmo desenho de `ledger/transacoes.test.ts` — a suíte se
 * pula sozinha sem `DIRECT_URL`.
 */

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;

async function inRollback<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const sentinel = Symbol("rollback");
  try {
    return await db!.begin(async (tx) => {
      const out = await fn(tx);
      throw Object.assign(new Error("rollback"), { sentinel, out });
    });
  } catch (error) {
    if (error && typeof error === "object" && "sentinel" in error && error.sentinel === sentinel) {
      return (error as unknown as { out: T }).out;
    }
    throw error;
  }
}

let contador = 0;

async function identidade(tx: postgres.TransactionSql, prefixo: string): Promise<string> {
  contador += 1;
  const [user] = await tx<{ id: string }[]>`
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${`${prefixo}-${Date.now()}-${contador}@teste.local`})
    returning id`;
  return user.id;
}

async function operadora(tx: postgres.TransactionSql) {
  const id = await identidade(tx, "adm");
  await tx`
    insert into profiles (id, role, name, email)
    values (${id}, 'admin', 'Operadora de Teste', ${`adm-${id}@teste.local`})`;
  return { id, role: "admin" as const };
}

type Ator = Awaited<ReturnType<typeof operadora>>;

async function empresa(tx: postgres.TransactionSql, ator: Ator) {
  const { id } = await empresaNaTransacao(tx, {
    nome: "Empresa de Teste",
    cnpj: null,
    inicio: null,
    fim: null,
    accent: null,
    ator,
  });
  return id;
}

async function parceiro(tx: postgres.TransactionSql, ator: Ator) {
  const userId = await identidade(tx, "par");
  await parceiroNaTransacao(tx, userId, {
    nome: "Helena Braga",
    email: `par-${userId}@teste.local`,
    headline: "Liderança em ambiente clínico",
    bio: null,
    areas: ["Liderança", "Saúde"],
    engajamento: "voluntario",
    maxPorSemana: 4,
    fuso: "America/Sao_Paulo",
    ator,
  });
  return userId;
}

async function profissional(tx: postgres.TransactionSql, orgId: string, ator: Ator) {
  const userId = await identidade(tx, "pro");
  await profissionalNaTransacao(tx, userId, {
    orgId,
    nome: "Mariana Costa",
    email: `pro-${userId}@teste.local`,
    cargo: "Coordenadora",
    area: null,
    ator,
  });
  return userId;
}

/** Sessão confirmada que começa amanhã — o que bloqueia arquivar e desativar. */
async function sessaoAmanha(
  tx: postgres.TransactionSql,
  orgId: string,
  partnerId: string,
  professionalId: string,
) {
  await tx`
    insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
    values (${orgId}, ${partnerId}, ${professionalId},
            now() + interval '1 day', now() + interval '1 day 30 minutes', 'confirmed')`;
}

async function auditorias(tx: postgres.TransactionSql, entidadeId: string, acao: string) {
  return tx<{ before: Record<string, unknown> | null; after: Record<string, unknown> | null }[]>`
    select before, after from audit_logs where entity_id = ${entidadeId} and action = ${acao}`;
}

describe("diferenca", () => {
  it("só devolve o que mudou, com os dois lados", () => {
    const d = diferenca({ a: 1, b: ["x"], c: null }, { a: 1, b: ["x", "y"], c: null });
    expect(d.campos).toEqual(["b"]);
    expect(d.antes).toEqual({ b: ["x"] });
    expect(d.depois).toEqual({ b: ["x", "y"] });
  });

  it("ordem da lista conta como mudança", () => {
    expect(diferenca({ a: ["x", "y"] }, { a: ["y", "x"] }).campos).toEqual(["a"]);
  });

  it("nada mudou, nada listado", () => {
    expect(diferenca({ a: 1, b: "z" }, { a: 1, b: "z" }).campos).toEqual([]);
  });
});

run("edição de Parceiro", () => {
  it("grava só o campo alterado no histórico", async () => {
    const r = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const id = await parceiro(tx, ator);
      const atual = (await parceiroParaEdicao(tx, id)) as DadosDoParceiro;

      const resultado = await edicaoParceiroNaTransacao(
        tx,
        id,
        { ...atual, headline: "Carreira em saúde", maxPorSemana: 6 },
        ator,
      );
      const [linha] = await tx<{ headline: string; max_per_week: number }[]>`
        select headline, max_per_week from partners where id = ${id}`;
      return { resultado, linha, log: await auditorias(tx, id, "editar_parceiro") };
    });

    expect(r.resultado.campos).toEqual(["headline", "maxPorSemana"]);
    expect(r.linha).toEqual({ headline: "Carreira em saúde", max_per_week: 6 });
    expect(r.log).toHaveLength(1);
    expect(r.log[0].before).toEqual({ headline: "Liderança em ambiente clínico", maxPorSemana: 4 });
    expect(r.log[0].after).toEqual({ headline: "Carreira em saúde", maxPorSemana: 6 });
  });

  it("salvar sem mudar nada não escreve nem audita", async () => {
    const r = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const id = await parceiro(tx, ator);
      const atual = (await parceiroParaEdicao(tx, id)) as DadosDoParceiro;
      const resultado = await edicaoParceiroNaTransacao(tx, id, atual, ator);
      return { resultado, log: await auditorias(tx, id, "editar_parceiro") };
    });

    expect(r.resultado.campos).toEqual([]);
    expect(r.log).toHaveLength(0);
  });

  it("não edita quem não é Parceiro", async () => {
    await expect(
      inRollback(async (tx) => {
        const ator = await operadora(tx);
        const orgId = await empresa(tx, ator);
        const pro = await profissional(tx, orgId, ator);
        const molde = (await parceiroParaEdicao(tx, await parceiro(tx, ator))) as DadosDoParceiro;
        await edicaoParceiroNaTransacao(tx, pro, molde, ator);
      }),
    ).rejects.toBeInstanceOf(PessoaInexistente);
  });
});

run("status do Parceiro", () => {
  it("arquivar tira o acesso; reativar devolve", async () => {
    const r = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const id = await parceiro(tx, ator);

      await statusParceiroNaTransacao(tx, id, "archived", ator);
      const [arquivado] = await tx<{ status: string; active: boolean }[]>`
        select pa.status::text, p.active from partners pa join profiles p on p.id = pa.id
         where pa.id = ${id}`;

      await statusParceiroNaTransacao(tx, id, "active", ator);
      const [reativado] = await tx<{ status: string; active: boolean }[]>`
        select pa.status::text, p.active from partners pa join profiles p on p.id = pa.id
         where pa.id = ${id}`;

      return { arquivado, reativado, log: await auditorias(tx, id, "alterar_status_parceiro") };
    });

    expect(r.arquivado).toEqual({ status: "archived", active: false });
    expect(r.reativado).toEqual({ status: "active", active: true });
    expect(r.log.map((l) => l.after)).toEqual([{ status: "archived" }, { status: "active" }]);
  });

  it("pausar esconde mas mantém o acesso", async () => {
    const r = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const id = await parceiro(tx, ator);
      await statusParceiroNaTransacao(tx, id, "paused", ator);
      const [linha] = await tx<{ status: string; active: boolean }[]>`
        select pa.status::text, p.active from partners pa join profiles p on p.id = pa.id
         where pa.id = ${id}`;
      return linha;
    });

    expect(r).toEqual({ status: "paused", active: true });
  });

  it("recusa transição fora do mapa — arquivado não vai para pausado", async () => {
    await expect(
      inRollback(async (tx) => {
        const ator = await operadora(tx);
        const id = await parceiro(tx, ator);
        await statusParceiroNaTransacao(tx, id, "archived", ator);
        await statusParceiroNaTransacao(tx, id, "paused", ator);
      }),
    ).rejects.toBeInstanceOf(TransicaoInvalida);
  });

  it("recusa arquivar com sessão marcada, mas deixa pausar", async () => {
    const pausou = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const id = await parceiro(tx, ator);
      await sessaoAmanha(tx, orgId, id, await profissional(tx, orgId, ator));

      await expect(statusParceiroNaTransacao(tx, id, "archived", ator)).rejects.toBeInstanceOf(
        TemSessaoFutura,
      );
      // A recusa sai de um `select`, antes de qualquer escrita, e a exceção é
      // do JavaScript, não do Postgres — a transação continua utilizável.
      await statusParceiroNaTransacao(tx, id, "paused", ator);
      const [linha] = await tx<{ status: string }[]>`
        select status::text from partners where id = ${id}`;
      return linha.status;
    });

    expect(pausou).toBe("paused");
  });
});

run("edição de Profissional", () => {
  it("edita e audita com a empresa", async () => {
    const r = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const id = await profissional(tx, orgId, ator);
      const [antes] = await tx<{ email: string }[]>`select email from profiles where id = ${id}`;

      const resultado = await edicaoProfissionalNaTransacao(
        tx,
        id,
        orgId,
        {
          nome: "Mariana Costa Lima",
          email: antes.email,
          cargo: "Coordenadora",
          area: "Pedagogia",
        },
        ator,
      );
      const [perfil] = await tx<{ name: string; area: string; role: string; org_id: string }[]>`
        select name, area, role::text, org_id from profiles where id = ${id}`;
      const [log] = await tx<{ org_id: string }[]>`
        select org_id from audit_logs where entity_id = ${id} and action = 'editar_profissional'`;
      return { resultado, perfil, log, orgId };
    });

    expect(r.resultado.campos).toEqual(["nome", "area"]);
    expect(r.perfil).toEqual({
      name: "Mariana Costa Lima",
      area: "Pedagogia",
      role: "professional",
      org_id: r.orgId,
    });
    expect(r.log.org_id).toBe(r.orgId);
  });

  it("recusa Profissional de outra empresa", async () => {
    await expect(
      inRollback(async (tx) => {
        const ator = await operadora(tx);
        const orgA = await empresa(tx, ator);
        const orgB = await empresa(tx, ator);
        const id = await profissional(tx, orgA, ator);
        await edicaoProfissionalNaTransacao(
          tx,
          id,
          orgB,
          { nome: "Outro", email: "x@teste.local", cargo: null, area: null },
          ator,
        );
      }),
    ).rejects.toBeInstanceOf(PessoaInexistente);
  });
});

run("acesso do Profissional", () => {
  it("desativa e reativa, auditando as duas coisas", async () => {
    const r = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const id = await profissional(tx, orgId, ator);

      const desligou = await acessoNaTransacao(tx, id, orgId, false, ator);
      const [inativo] = await tx<
        { active: boolean }[]
      >`select active from profiles where id = ${id}`;
      const repetiu = await acessoNaTransacao(tx, id, orgId, false, ator);
      await acessoNaTransacao(tx, id, orgId, true, ator);
      const [ativo] = await tx<{ active: boolean }[]>`select active from profiles where id = ${id}`;
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${id}`;

      return {
        desligou,
        repetiu,
        inativo: inativo.active,
        ativo: ativo.active,
        carteira,
        desativacoes: await auditorias(tx, id, "desativar_conta"),
        reativacoes: await auditorias(tx, id, "reativar_conta"),
      };
    });

    expect(r.desligou.mudou).toBe(true);
    expect(r.inativo).toBe(false);
    // Desativar de novo não é decisão nova: não grava outra linha.
    expect(r.repetiu.mudou).toBe(false);
    expect(r.desativacoes).toHaveLength(1);
    expect(r.reativacoes).toHaveLength(1);
    expect(r.ativo).toBe(true);
    // A carteira sobrevive — desativar não é `reclaim`.
    expect(r.carteira.balance).toBe(0);
  });

  it("recusa desativar com sessão marcada", async () => {
    await expect(
      inRollback(async (tx) => {
        const ator = await operadora(tx);
        const orgId = await empresa(tx, ator);
        const id = await profissional(tx, orgId, ator);
        await sessaoAmanha(tx, orgId, await parceiro(tx, ator), id);
        await acessoNaTransacao(tx, id, orgId, false, ator);
      }),
    ).rejects.toBeInstanceOf(TemSessaoFutura);
  });

  it("não mexe no acesso de Parceiro por esta porta", async () => {
    await expect(
      inRollback(async (tx) => {
        const ator = await operadora(tx);
        const orgId = await empresa(tx, ator);
        await acessoNaTransacao(tx, await parceiro(tx, ator), orgId, false, ator);
      }),
    ).rejects.toBeInstanceOf(PessoaInexistente);
  });
});
