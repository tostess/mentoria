import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { TetoDaCarteira, ehChaveRepetida, ehSaldoNegativo } from "./erros";
import { chaveAlocacaoManual } from "./keys";
import { alocacaoNaTransacao, compraNaTransacao } from "./operacoes";
import {
  empresaNaTransacao,
  parceiroNaTransacao,
  profissionalNaTransacao,
} from "@/lib/pessoas/operacoes";

/**
 * As transações da P1, exercitadas contra o Postgres de verdade.
 *
 * O ponto de chamar `compraNaTransacao` e `alocacaoNaTransacao` em vez de
 * reescrever o SQL: é o mesmo código que a Server Action executa. Um teste que
 * repetisse os inserts provaria que o banco funciona, não que a aplicação usa
 * o banco certo.
 *
 * Mesmo desenho de `db/invariantes.test.ts` — tudo dentro de uma transação que
 * sempre sofre rollback, e a suíte se pula sozinha sem `DIRECT_URL`. É o que
 * permite testar livro-caixa apesar do trigger de imutabilidade: `rollback`
 * não é `delete`, então o gatilho nem é consultado.
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

/** Token no formato que `keys.ts` aceita, diferente a cada chamada. */
function token(): string {
  contador += 1;
  return `${Date.now().toString(36)}-teste-${contador}`;
}

async function identidade(tx: postgres.TransactionSql, prefixo: string): Promise<string> {
  contador += 1;
  const [user] = await tx<{ id: string }[]>`
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${`${prefixo}-${Date.now()}-${contador}@teste.local`})
    returning id`;
  return user.id;
}

/** Um admin de verdade: `audit_logs.actor_id` é FK para ninguém, mas o nome é lido. */
async function operadora(tx: postgres.TransactionSql) {
  const id = await identidade(tx, "adm");
  await tx`
    insert into profiles (id, role, name, email)
    values (${id}, 'admin', 'Operadora de Teste', ${`adm-${id}@teste.local`})`;
  return { id, role: "admin" as const };
}

/** Empresa criada pelo caminho da aplicação — já vem com carteira. */
async function empresa(tx: postgres.TransactionSql, ator: { id: string; role: "admin" }) {
  const { id } = await empresaNaTransacao(tx, {
    nome: "Empresa de Teste",
    cnpj: "12345678000190",
    inicio: "2026-09-01",
    fim: "2027-08-31",
    accent: "#123456",
    ator,
  });
  return id;
}

async function profissional(
  tx: postgres.TransactionSql,
  orgId: string,
  ator: { id: string; role: "admin" },
) {
  const userId = await identidade(tx, "pro");
  await profissionalNaTransacao(tx, userId, {
    orgId,
    nome: "Pro Teste",
    email: `pro-${userId}@teste.local`,
    cargo: "Coordenador",
    area: null,
    ator,
  });
  return userId;
}

run("criação de empresa", () => {
  it("cria a carteira do contrato na mesma transação", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;
      const [org] = await tx<{ contracted_fichas: number; branding: unknown }[]>`
        select contracted_fichas, branding from orgs where id = ${orgId}`;

      return { carteira, org };
    });

    // Sem esta linha, a primeira compra falharia com "carteira de empresa
    // inexistente" — o trigger de saldo só sabe somar.
    expect(resultado.carteira).toBeDefined();
    expect(resultado.carteira.balance).toBe(0);
    // Existir e ter comprado são dois fatos: a empresa nasce com contrato zero.
    expect(resultado.org.contracted_fichas).toBe(0);
    expect(resultado.org.branding).toEqual({ accent: "#123456" });
  });

  it("grava auditoria da criação (invariante 12)", async () => {
    const registros = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);

      return tx<{ action: string; actor_role: string; entity_id: string }[]>`
        select action, actor_role::text, entity_id
          from audit_logs where org_id = ${orgId} and action = 'criar_empresa'`;
    });

    expect(registros).toHaveLength(1);
    expect(registros[0].actor_role).toBe("admin");
  });
});

run("registro de contrato", () => {
  it("soma no livro-caixa e no tamanho do contrato de uma vez", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);

      const primeira = await compraNaTransacao(tx, {
        orgId,
        fichas: 120,
        referencia: "Contrato anual",
        token: token(),
        ator,
      });
      const segunda = await compraNaTransacao(tx, {
        orgId,
        fichas: 30,
        referencia: "Aditivo",
        token: token(),
        ator,
      });

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;

      return { primeira, segunda, saldo: carteira.balance };
    });

    expect(resultado.primeira).toEqual({ saldo: 120, contratadas: 120 });
    // Os dois números andam juntos: contrato de 150, saldo de 150.
    expect(resultado.segunda).toEqual({ saldo: 150, contratadas: 150 });
    expect(resultado.saldo).toBe(150);
  });

  it("o trigger escreve balance_after, não quem insere (invariante 3)", async () => {
    const lancamentos = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      await compraNaTransacao(tx, {
        orgId,
        fichas: 40,
        referencia: null,
        token: token(),
        ator,
      });

      return tx<{ amount: number; balance_after: number }[]>`
        select amount, balance_after from org_ledger where org_id = ${orgId}`;
    });

    // O insert manda 0 em `balance_after`; o valor abaixo veio do trigger.
    expect(lancamentos[0].balance_after).toBe(40);
  });

  it("o mesmo token duas vezes é recusado pela chave única (invariante 16)", async () => {
    const erro = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const mesmo = token();

      await compraNaTransacao(tx, {
        orgId,
        fichas: 10,
        referencia: null,
        token: mesmo,
        ator,
      });

      // Savepoint: a violação aborta o bloco, e sem ele a transação inteira
      // ficaria inutilizável e o teste não conseguiria asserir nada depois.
      return tx
        .savepoint(async (sp) => {
          await compraNaTransacao(sp, {
            orgId,
            fichas: 10,
            referencia: null,
            token: mesmo,
            ator,
          });
          return null;
        })
        .then(() => null)
        .catch((falha: unknown) => falha);
    });

    expect(erro).not.toBeNull();
    expect(ehChaveRepetida(erro)).toBe(true);
  });
});

run("alocação de fichas — invariante 6", () => {
  it("debita o contrato e credita a carteira na mesma transação", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      await compraNaTransacao(tx, {
        orgId,
        fichas: 10,
        referencia: null,
        token: token(),
        ator,
      });

      const alocado = await alocacaoNaTransacao(tx, {
        orgId,
        userId,
        quantidade: 2,
        tetoCarteira: 6,
        token: token(),
        ator,
      });

      const [contrato] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;

      return { alocado, contrato: contrato.balance, carteira: carteira.balance };
    });

    expect(resultado.alocado).toEqual({ saldoContrato: 8, saldoCarteira: 2 });
    expect(resultado.contrato).toBe(8);
    expect(resultado.carteira).toBe(2);
  });

  /**
   * O coração da invariante 6. Se o crédito na carteira falhar, o débito no
   * contrato não pode sobreviver — senão a ficha desaparece do sistema.
   */
  it("crédito que falha desfaz o débito: a ficha não evapora", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      await compraNaTransacao(tx, {
        orgId,
        fichas: 10,
        referencia: null,
        token: token(),
        ator,
      });

      /**
       * Faz o **segundo** insert falhar, não o primeiro: a chave que a alocação
       * vai usar no `wallet_ledger` já está ocupada. Então o débito no
       * `org_ledger` passa, o crédito na carteira bate na unicidade, e o que
       * sobra mede exatamente a invariante 6.
       *
       * Apagar a carteira não serviria — a alocação tranca a carteira antes de
       * debitar e falharia cedo, provando outra coisa.
       */
      const mesmo = token();
      await tx`
        insert into wallet_ledger (user_id, org_id, type, amount, balance_after, idempotency_key)
        values (${userId}, ${orgId}, 'allocate', 1, 0,
                ${chaveAlocacaoManual(userId, mesmo)})`;

      const falhou = await tx
        .savepoint(async (sp) => {
          await alocacaoNaTransacao(sp, {
            orgId,
            userId,
            quantidade: 2,
            tetoCarteira: 6,
            token: mesmo,
            ator,
          });
          return false;
        })
        .then(() => false)
        .catch((erro: unknown) => ehChaveRepetida(erro));

      const [contrato] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;
      const lancamentos = await tx<{ n: number }[]>`
        select count(*)::int as n from org_ledger
         where org_id = ${orgId} and type = 'allocate'`;

      return {
        falhou,
        contrato: contrato.balance,
        carteira: carteira.balance,
        allocates: lancamentos[0].n,
      };
    });

    expect(resultado.falhou).toBe(true);
    // As dez continuam no contrato, e não há `allocate` pendurado nele.
    expect(resultado.contrato).toBe(10);
    expect(resultado.allocates).toBe(0);
    // A carteira ficou só com a ficha que já estava lá antes da tentativa.
    expect(resultado.carteira).toBe(1);
  });

  it("recusa alocar mais do que o contrato tem — o check derruba tudo", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      await compraNaTransacao(tx, {
        orgId,
        fichas: 1,
        referencia: null,
        token: token(),
        ator,
      });

      const erro = await tx
        .savepoint(async (sp) => {
          await alocacaoNaTransacao(sp, {
            orgId,
            userId,
            quantidade: 5,
            tetoCarteira: 6,
            token: token(),
            ator,
          });
          return null;
        })
        .then(() => null)
        .catch((falha: unknown) => falha);

      const [contrato] = await tx<{ balance: number }[]>`
        select balance from org_wallets where org_id = ${orgId}`;
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;

      return { erro, contrato: contrato.balance, carteira: carteira.balance };
    });

    expect(ehSaldoNegativo(resultado.erro)).toBe(true);
    expect(resultado.contrato).toBe(1);
    expect(resultado.carteira).toBe(0);
  });

  it("recusa passar do teto da carteira, antes de mexer em livro-caixa", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      await compraNaTransacao(tx, {
        orgId,
        fichas: 50,
        referencia: null,
        token: token(),
        ator,
      });
      await alocacaoNaTransacao(tx, {
        orgId,
        userId,
        quantidade: 5,
        tetoCarteira: 6,
        token: token(),
        ator,
      });

      const erro = await tx
        .savepoint(async (sp) => {
          await alocacaoNaTransacao(sp, {
            orgId,
            userId,
            quantidade: 3,
            tetoCarteira: 6,
            token: token(),
            ator,
          });
          return null;
        })
        .then(() => null)
        .catch((falha: unknown) => falha);

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${userId}`;

      return { erro, carteira: carteira.balance };
    });

    expect(resultado.erro).toBeInstanceOf(TetoDaCarteira);
    // A mensagem diz quanto cabe, não só que não cabe.
    expect((resultado.erro as TetoDaCarteira).message).toContain("1");
    expect(resultado.carteira).toBe(5);
  });

  it("recusa carteira de outra empresa (invariante 13)", async () => {
    const erro = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const daPessoa = await empresa(tx, ator);
      const outra = await empresa(tx, ator);
      const userId = await profissional(tx, daPessoa, ator);
      await compraNaTransacao(tx, {
        orgId: outra,
        fichas: 10,
        referencia: null,
        token: token(),
        ator,
      });

      return tx
        .savepoint(async (sp) => {
          await alocacaoNaTransacao(sp, {
            orgId: outra,
            userId,
            quantidade: 1,
            tetoCarteira: 6,
            token: token(),
            ator,
          });
          return null;
        })
        .then(() => null)
        .catch((falha: unknown) => falha);
    });

    expect((erro as Error).message).toContain("carteira de outra empresa");
  });

  it("grava auditoria da alocação, com os dois saldos (invariante 12)", async () => {
    const registro = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);
      await compraNaTransacao(tx, {
        orgId,
        fichas: 10,
        referencia: null,
        token: token(),
        ator,
      });
      await alocacaoNaTransacao(tx, {
        orgId,
        userId,
        quantidade: 2,
        tetoCarteira: 6,
        token: token(),
        ator,
      });

      const [linha] = await tx<{ after: Record<string, number>; entity_id: string }[]>`
        select after, entity_id from audit_logs
         where action = 'alocar_fichas' and org_id = ${orgId}`;
      return { linha, userId };
    });

    expect(registro.linha.entity_id).toBe(registro.userId);
    expect(registro.linha.after.saldo_contrato_depois).toBe(8);
    expect(registro.linha.after.saldo_carteira_depois).toBe(2);
  });
});

run("criação de Parceiro", () => {
  it("nasce ativo, sem empresa e com quem aprovou registrado", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
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

      const [perfil] = await tx<{ org_id: string | null; role: string }[]>`
        select org_id, role::text from profiles where id = ${userId}`;
      const [parceiro] = await tx<
        { status: string; areas: string[]; approved_by: string | null }[]
      >`select status::text, areas, approved_by from partners where id = ${userId}`;

      return { perfil, parceiro, ator };
    });

    // Invariante 9: o Parceiro é da plataforma, não de uma empresa.
    expect(resultado.perfil.org_id).toBeNull();
    expect(resultado.perfil.role).toBe("partner");
    // Invariante 8: quem move para `active` é o admin, e fica registrado.
    expect(resultado.parceiro.status).toBe("active");
    expect(resultado.parceiro.approved_by).toBe(resultado.ator.id);
    expect(resultado.parceiro.areas).toEqual(["Liderança", "Saúde"]);
  });

  it("recusa Parceiro com empresa — o check de profiles não deixa", async () => {
    await expect(
      inRollback(async (tx) => {
        const ator = await operadora(tx);
        const orgId = await empresa(tx, ator);
        const userId = await identidade(tx, "par");

        await tx`
          insert into profiles (id, org_id, role, name, email)
          values (${userId}, ${orgId}, 'partner', 'Errado', ${`x-${userId}@teste.local`})`;
      }),
    ).rejects.toThrow(/profiles_org_scope/);
  });
});

run("criação de Profissional", () => {
  it("cria perfil com empresa e carteira vazia, de uma vez", async () => {
    const resultado = await inRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const userId = await profissional(tx, orgId, ator);

      const [perfil] = await tx<{ org_id: string | null; role: string }[]>`
        select org_id, role::text from profiles where id = ${userId}`;
      const [carteira] = await tx<{ balance: number; org_id: string }[]>`
        select balance, org_id from wallets where user_id = ${userId}`;

      return { perfil, carteira, orgId };
    });

    expect(resultado.perfil.role).toBe("professional");
    expect(resultado.perfil.org_id).toBe(resultado.orgId);
    expect(resultado.carteira.balance).toBe(0);
    expect(resultado.carteira.org_id).toBe(resultado.orgId);
  });
});
