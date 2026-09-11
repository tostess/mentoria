import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * As invariantes de banco, testadas contra o Postgres de verdade.
 *
 * Rodam só quando `DIRECT_URL` existe — em CI sem credencial a suíte inteira
 * é pulada em vez de falhar. Tudo acontece dentro de uma transação que
 * **sempre** sofre rollback: o banco fica exatamente como estava.
 *
 * Testar por SQL e não por camada de aplicação é o ponto. As invariantes 3, 6
 * e 7 dizem que a garantia é do banco; um teste que passasse pelo código não
 * provaria isso.
 */

const url = process.env.DIRECT_URL;
const sql = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await sql?.end({ timeout: 5 });
});

const db = sql;
const run = db ? describe : describe.skip;

/** Executa dentro de uma transação e desfaz tudo no fim. */
async function inRollback<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const sentinel = Symbol("rollback");
  try {
    return await db!.begin(async (tx) => {
      const out = await fn(tx);
      // Abortar de propósito: nada deste teste pode sobreviver.
      throw Object.assign(new Error("rollback"), { sentinel, out });
    });
  } catch (error) {
    if (error && typeof error === "object" && "sentinel" in error && error.sentinel === sentinel) {
      return (error as unknown as { out: T }).out;
    }
    throw error;
  }
}

/** Cenário mínimo: uma empresa, um profissional com carteira, um parceiro. */
async function seed(tx: postgres.TransactionSql) {
  const [org] = await tx<{ id: string }[]>`
    insert into orgs (name) values ('Empresa de Teste') returning id`;

  await tx`insert into org_wallets (org_id) values (${org.id})`;

  const [authUser] = await tx<{ id: string }[]>`
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${`pro-${Date.now()}@teste.local`})
    returning id`;

  const [partnerUser] = await tx<{ id: string }[]>`
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${`par-${Date.now()}@teste.local`})
    returning id`;

  await tx`
    insert into profiles (id, org_id, role, name, email)
    values (${authUser.id}, ${org.id}, 'professional', 'Pro Teste', 'pro@teste.local')`;

  await tx`
    insert into profiles (id, role, name, email)
    values (${partnerUser.id}, 'partner', 'Parceiro Teste', 'par@teste.local')`;

  await tx`insert into partners (id, status) values (${partnerUser.id}, 'active')`;
  await tx`insert into wallets (user_id, org_id) values (${authUser.id}, ${org.id})`;

  return { orgId: org.id, professionalId: authUser.id, partnerId: partnerUser.id };
}

run("invariante 3 — saldo é derivado do livro-caixa", () => {
  it("o trigger soma o lançamento no saldo e preenche balance_after", async () => {
    const result = await inRollback(async (tx) => {
      const { orgId, professionalId } = await seed(tx);

      await tx`
        insert into wallet_ledger (user_id, org_id, type, amount, balance_after, idempotency_key)
        values (${professionalId}, ${orgId}, 'allocate', 2, 0, ${`t-${Date.now()}-a`})`;

      const [wallet] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${professionalId}`;
      const [entry] = await tx<{ balance_after: number }[]>`
        select balance_after from wallet_ledger where user_id = ${professionalId}`;

      return { saldo: wallet.balance, registrado: entry.balance_after };
    });

    expect(result.saldo).toBe(2);
    // O valor que veio no insert era 0 — quem escreve balance_after é o trigger.
    expect(result.registrado).toBe(2);
  });

  it("saldo não fica negativo: o check derruba a transação", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId, professionalId } = await seed(tx);
        await tx`
          insert into wallet_ledger (user_id, org_id, type, amount, balance_after, idempotency_key)
          values (${professionalId}, ${orgId}, 'spend', -1, 0, ${`t-${Date.now()}-b`})`;
      }),
    ).rejects.toThrow(/wallets_balance_nonneg|violates check constraint/i);
  });

  it("livro-caixa é imutável: update é bloqueado", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId, professionalId } = await seed(tx);
        await tx`
          insert into wallet_ledger (user_id, org_id, type, amount, balance_after, idempotency_key)
          values (${professionalId}, ${orgId}, 'allocate', 1, 0, ${`t-${Date.now()}-c`})`;
        await tx`update wallet_ledger set amount = 99 where user_id = ${professionalId}`;
      }),
    ).rejects.toThrow(/imutável/i);
  });

  it("livro-caixa é imutável: delete é bloqueado", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId, professionalId } = await seed(tx);
        await tx`
          insert into wallet_ledger (user_id, org_id, type, amount, balance_after, idempotency_key)
          values (${professionalId}, ${orgId}, 'allocate', 1, 0, ${`t-${Date.now()}-d`})`;
        await tx`delete from wallet_ledger where user_id = ${professionalId}`;
      }),
    ).rejects.toThrow(/imutável/i);
  });
});

run("invariante 16 — trabalho agendado é idempotente", () => {
  it("idempotency_key repetida é recusada", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId, professionalId } = await seed(tx);
        const key = `t-${Date.now()}-dup`;
        for (let i = 0; i < 2; i++) {
          await tx`
            insert into wallet_ledger (user_id, org_id, type, amount, balance_after, idempotency_key)
            values (${professionalId}, ${orgId}, 'allocate', 1, 0, ${key})`;
        }
      }),
    ).rejects.toThrow(/idempotency_key|duplicate key/i);
  });
});

run("invariante 7 — sobreposição é impedida pelo banco", () => {
  const inicio = "2027-03-01T13:00:00Z";

  it("duas sessões do mesmo Parceiro não podem se cruzar", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId, professionalId, partnerId } = await seed(tx);
        await tx`
          insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
          values (${orgId}, ${partnerId}, ${professionalId},
                  ${inicio}::timestamptz, ${inicio}::timestamptz + interval '30 min', 'confirmed')`;
        // Começa 15 min depois: cruza.
        await tx`
          insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
          values (${orgId}, ${partnerId}, ${professionalId},
                  ${inicio}::timestamptz + interval '15 min',
                  ${inicio}::timestamptz + interval '45 min', 'pending')`;
      }),
    ).rejects.toThrow(/bookings_no_overlap|conflicting key|exclusion constraint/i);
  });

  it("a extensão para 60 min também é coberta", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId, professionalId, partnerId } = await seed(tx);
        const [b] = await tx<{ id: string }[]>`
          insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
          values (${orgId}, ${partnerId}, ${professionalId},
                  ${inicio}::timestamptz, ${inicio}::timestamptz + interval '30 min', 'confirmed')
          returning id`;
        // Sessão seguinte, encostada — válida enquanto a primeira tem 30 min.
        await tx`
          insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
          values (${orgId}, ${partnerId}, ${professionalId},
                  ${inicio}::timestamptz + interval '30 min',
                  ${inicio}::timestamptz + interval '60 min', 'confirmed')`;
        // Estender a primeira para 60 min invade a segunda.
        await tx`
          update bookings set end_at = ${inicio}::timestamptz + interval '60 min',
                              extended_by = 30
           where id = ${b.id}`;
      }),
    ).rejects.toThrow(/bookings_no_overlap|conflicting key|exclusion constraint/i);
  });

  it("sessão cancelada libera o horário", async () => {
    const ok = await inRollback(async (tx) => {
      const { orgId, professionalId, partnerId } = await seed(tx);
      await tx`
        insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
        values (${orgId}, ${partnerId}, ${professionalId},
                ${inicio}::timestamptz, ${inicio}::timestamptz + interval '30 min', 'cancelled')`;
      await tx`
        insert into bookings (org_id, partner_id, professional_id, start_at, end_at, status)
        values (${orgId}, ${partnerId}, ${professionalId},
                ${inicio}::timestamptz, ${inicio}::timestamptz + interval '30 min', 'confirmed')`;
      const [r] = await tx<{ n: number }[]>`
        select count(*)::int n from bookings where partner_id = ${partnerId}`;
      return r.n;
    });
    expect(ok).toBe(2);
  });
});

run("invariante 9 — escopo assimétrico no esquema", () => {
  it("Profissional exige org_id", async () => {
    await expect(
      inRollback(async (tx) => {
        const [u] = await tx<{ id: string }[]>`
          insert into auth.users (id, instance_id, aud, role, email)
          values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
                  'authenticated', 'authenticated', ${`x-${Date.now()}@teste.local`})
          returning id`;
        await tx`
          insert into profiles (id, role, name, email)
          values (${u.id}, 'professional', 'Sem empresa', 'x@teste.local')`;
      }),
    ).rejects.toThrow(/profiles_org_scope/i);
  });

  it("Parceiro não pode ter org_id", async () => {
    await expect(
      inRollback(async (tx) => {
        const { orgId } = await seed(tx);
        const [u] = await tx<{ id: string }[]>`
          insert into auth.users (id, instance_id, aud, role, email)
          values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
                  'authenticated', 'authenticated', ${`y-${Date.now()}@teste.local`})
          returning id`;
        await tx`
          insert into profiles (id, org_id, role, name, email)
          values (${u.id}, ${orgId}, 'partner', 'Parceiro de empresa', 'y@teste.local')`;
      }),
    ).rejects.toThrow(/profiles_org_scope/i);
  });
});

run("invariantes 4 e 8 — o que o papel autenticado não pode escrever", () => {
  it("`authenticated` não tem insert/update/delete nas cinco tabelas travadas", async () => {
    const travadas = ["bookings", "wallets", "wallet_ledger", "org_wallets", "org_ledger"];
    const rows = await db!<{ table_name: string; privilege_type: string }[]>`
      select table_name, privilege_type
        from information_schema.role_table_grants
       where grantee = 'authenticated'
         and table_schema = 'public'
         and table_name = any(${travadas})
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE')`;
    expect(rows).toEqual([]);
  });

  it("o Parceiro não tem privilégio de escrita na coluna `status`", async () => {
    const rows = await db!<{ column_name: string }[]>`
      select column_name
        from information_schema.column_privileges
       where grantee = 'authenticated'
         and table_schema = 'public'
         and table_name = 'partners'
         and privilege_type = 'UPDATE'
       order by column_name`;
    const colunas = rows.map((r) => r.column_name);
    expect(colunas).not.toContain("status");
    expect(colunas).toContain("headline");
  });

  it("o usuário não pode escrever o próprio `role` nem `org_id`", async () => {
    const rows = await db!<{ column_name: string }[]>`
      select column_name
        from information_schema.column_privileges
       where grantee = 'authenticated'
         and table_schema = 'public'
         and table_name = 'profiles'
         and privilege_type = 'UPDATE'`;
    const colunas = rows.map((r) => r.column_name);
    expect(colunas).not.toContain("role");
    expect(colunas).not.toContain("org_id");
    expect(colunas).toContain("name");
  });
});

run("invariante 10 — o RH nunca vê conteúdo de sessão", () => {
  it("nenhuma policy menciona org_admin nas tabelas de conteúdo", async () => {
    const conteudo = ["bookings", "briefings", "reviews", "session_events", "async_questions"];
    const rows = await db!<{ tablename: string; policyname: string }[]>`
      select tablename, policyname
        from pg_policies
       where schemaname = 'public'
         and tablename = any(${conteudo})
         and (coalesce(qual, '') like '%org_admin%'
              or coalesce(with_check, '') like '%org_admin%')`;
    expect(rows).toEqual([]);
  });

  it("RLS está ligada em toda tabela do schema public", async () => {
    const rows = await db!<{ tablename: string }[]>`
      select c.relname as tablename
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows).toEqual([]);
  });
});
