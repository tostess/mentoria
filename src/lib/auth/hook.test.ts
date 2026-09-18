import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * Invariante 19 na origem: papel e `org_id` entram no JWT pelo banco.
 *
 * Toda a RLS da Etapa 3 chama `auth_role()` e `auth_org_id()`, que leem
 * `request.jwt.claims`. Quem põe as claims lá é o `custom_access_token_hook`,
 * na emissão do token. Sem ele o esquema inteiro está montado e desligado:
 * quem entra é `authenticated` sem papel, e toda policy nega.
 *
 * Mesmo desenho do `db/invariantes.test.ts`: Postgres de verdade, tudo dentro
 * de uma transação que sempre sofre rollback, e a suíte se pula sozinha sem
 * `DIRECT_URL`.
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

/**
 * JSON de verdade. `Record<string, unknown>` não serve: o `tx.json()` do
 * postgres.js exige um valor serializável, e `unknown` não prova que é.
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type Claims = { [key: string]: JsonValue };

/** Cria a identidade em `auth.users` e devolve o id. */
async function novoUsuario(tx: postgres.TransactionSql): Promise<string> {
  const email = `hook-${crypto.randomUUID()}@teste.local`;
  const [row] = await tx<{ id: string }[]>`
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${email})
    returning id`;
  return row.id;
}

async function novaEmpresa(tx: postgres.TransactionSql): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into orgs (name) values ('Empresa do Hook') returning id`;
  return row.id;
}

/**
 * Roda o hook como o servidor de auth rodaria e devolve as claims.
 *
 * O evento vai por `tx.json()`, não por `JSON.stringify`. O postgres.js
 * infere o tipo do parâmetro pelo `::jsonb` do SQL e, vendo uma string JS,
 * serializa ela **como** jsonb — o que produz um jsonb string, não um objeto.
 * O hook então recebe `"{...}"` em vez de `{...}`, não acha `user_id`, e
 * devolve o evento intacto: todo teste passaria a medir o harness.
 */
async function emitir(
  tx: postgres.TransactionSql,
  userId: string,
  claims: Claims = {},
): Promise<Claims> {
  const [row] = await tx<{ out: { claims?: Claims } }[]>`
    select public.custom_access_token_hook(${tx.json({ user_id: userId, claims })}) as out`;
  return row.out.claims ?? {};
}

run("invariante 19 — o hook escreve papel e empresa no token", () => {
  it("Profissional recebe papel e empresa", async () => {
    await inRollback(async (tx) => {
      const orgId = await novaEmpresa(tx);
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, org_id, role, name, email)
        values (${userId}, ${orgId}, 'professional', 'Pro', 'pro@teste.local')`;

      const claims = await emitir(tx, userId);
      expect(claims.user_role).toBe("professional");
      expect(claims.org_id).toBe(orgId);
    });
  });

  it("RH recebe papel e empresa", async () => {
    await inRollback(async (tx) => {
      const orgId = await novaEmpresa(tx);
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, org_id, role, name, email)
        values (${userId}, ${orgId}, 'org_admin', 'RH', 'rh@teste.local')`;

      const claims = await emitir(tx, userId);
      expect(claims.user_role).toBe("org_admin");
      expect(claims.org_id).toBe(orgId);
    });
  });

  /**
   * Invariante 9: Parceiro é da plataforma. A claim tem de estar **ausente**,
   * não nula — claim ausente e claim nula se comportam igual em `auth_org_id()`,
   * mas ausente é o que diz a verdade sobre quem não pertence a empresa nenhuma.
   */
  it("Parceiro recebe papel e nenhuma empresa", async () => {
    await inRollback(async (tx) => {
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, role, name, email)
        values (${userId}, 'partner', 'Parceiro', 'par@teste.local')`;

      const claims = await emitir(tx, userId);
      expect(claims.user_role).toBe("partner");
      expect("org_id" in claims).toBe(false);
    });
  });

  it("admin também sai sem empresa", async () => {
    await inRollback(async (tx) => {
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, role, name, email)
        values (${userId}, 'admin', 'Operadora', 'adm@teste.local')`;

      const claims = await emitir(tx, userId);
      expect(claims.user_role).toBe("admin");
      expect("org_id" in claims).toBe(false);
    });
  });

  it("preserva as claims que o servidor de auth já tinha montado", async () => {
    await inRollback(async (tx) => {
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, role, name, email)
        values (${userId}, 'admin', 'Operadora', 'adm@teste.local')`;

      const claims = await emitir(tx, userId, {
        sub: userId,
        aud: "authenticated",
        role: "authenticated",
      });
      expect(claims.sub).toBe(userId);
      expect(claims.aud).toBe("authenticated");
      expect(claims.role).toBe("authenticated");
      expect(claims.user_role).toBe("admin");
    });
  });
});

run("desligar o acesso é não escrever a claim", () => {
  /**
   * É o desligamento mais barato que existe: sem `user_role`, toda policy da
   * Etapa 3 nega sozinha, sem uma linha de código na aplicação.
   */
  it("pessoa inativa sai sem papel", async () => {
    await inRollback(async (tx) => {
      const orgId = await novaEmpresa(tx);
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, org_id, role, name, email, active)
        values (${userId}, ${orgId}, 'professional', 'Pro', 'pro@teste.local', false)`;

      const claims = await emitir(tx, userId);
      expect("user_role" in claims).toBe(false);
      expect("org_id" in claims).toBe(false);
    });
  });

  it("conta excluída (LGPD) sai sem papel", async () => {
    await inRollback(async (tx) => {
      const orgId = await novaEmpresa(tx);
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, org_id, role, name, email, deleted_at)
        values (${userId}, ${orgId}, 'professional', 'Pro', 'pro@teste.local', now())`;

      const claims = await emitir(tx, userId);
      expect("user_role" in claims).toBe(false);
    });
  });

  /**
   * Usuário criado em `auth.users` antes da linha em `profiles` consegue
   * token, mas não enxerga nada. Derrubar o login com exceção deixaria a
   * criação de conta pelo admin em um estado sem saída.
   */
  it("perfil inexistente devolve o evento intacto", async () => {
    await inRollback(async (tx) => {
      const userId = await novoUsuario(tx);
      const claims = await emitir(tx, userId, { sub: userId });
      expect(claims).toEqual({ sub: userId });
    });
  });
});

run("o hook é do servidor de auth, e de mais ninguém", () => {
  /**
   * `supabase_auth_admin` não é `bypassrls` e não é dono de `public`. Sem o
   * grant e sem a policy própria o hook leria zero linhas e **todo mundo**
   * receberia token sem papel — a falha mais silenciosa possível, porque
   * ninguém veria erro, só telas vazias.
   *
   * Aqui não dá para exercitar o caminho como se faz com `authenticated`: o
   * `postgres` não é membro de `supabase_auth_admin` e `set role` é negado.
   * Então a pergunta vai ao Postgres em vez de ao catálogo — `has_*_privilege`
   * responde "este papel consegue?", que é a pergunta certa, e a policy é
   * conferida por existir, ser permissiva e valer para esse papel.
   */
  it("o servidor de auth alcança o perfil: privilégio e policy", async () => {
    const [priv] = await db!<
      { executa: boolean; usaSchema: boolean; leProfiles: boolean }[]
    >`
      select has_function_privilege('supabase_auth_admin',
               'public.custom_access_token_hook(jsonb)', 'EXECUTE') as "executa",
             has_schema_privilege('supabase_auth_admin', 'public', 'USAGE')  as "usaSchema",
             has_table_privilege('supabase_auth_admin', 'public.profiles', 'SELECT') as "leProfiles"`;

    expect(priv).toEqual({ executa: true, usaSchema: true, leProfiles: true });

    const [policy] = await db!<{ permissive: string; roles: string }[]>`
      select permissive, roles::text
        from pg_policies
       where schemaname = 'public'
         and tablename = 'profiles'
         and policyname = 'profiles_auth_admin_read'`;

    expect(policy?.permissive).toBe("PERMISSIVE");
    expect(policy?.roles).toContain("supabase_auth_admin");
  });

  /**
   * A função é `security definer`. Se `authenticated` pudesse executá-la,
   * qualquer pessoa logada montaria um evento com o `user_id` alheio e leria
   * o papel e a empresa de quem quisesse.
   */
  it("`authenticated` não pode executar", async () => {
    await inRollback(async (tx) => {
      const userId = await novoUsuario(tx);
      await tx`set local role authenticated`;
      await expect(emitir(tx, userId)).rejects.toMatchObject({ code: "42501" });
    });
  });
});

run("as claims do hook alimentam a RLS da Etapa 3", () => {
  /**
   * O elo que fecha a invariante 19: o que o hook escreve é exatamente o que
   * `auth_role()` e `auth_org_id()` leem. Testar as duas pontas separadas
   * deixaria passar uma divergência de nome de claim — e o sintoma seria
   * "tudo negado", sem erro em lugar nenhum.
   */
  it("auth_role() e auth_org_id() leem o que o hook escreveu", async () => {
    await inRollback(async (tx) => {
      const orgId = await novaEmpresa(tx);
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, org_id, role, name, email)
        values (${userId}, ${orgId}, 'org_admin', 'RH', 'rh@teste.local')`;

      const claims = await emitir(tx, userId, { sub: userId, role: "authenticated" });

      // É assim que o PostgREST entrega o token ao Postgres a cada requisição.
      await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      const [lido] = await tx<{ papel: string; empresa: string | null }[]>`
        select auth_role() as papel, auth_org_id() as empresa`;

      expect(lido.papel).toBe("org_admin");
      expect(lido.empresa).toBe(orgId);
    });
  });

  it("Parceiro chega na RLS com papel e sem empresa", async () => {
    await inRollback(async (tx) => {
      const userId = await novoUsuario(tx);
      await tx`
        insert into profiles (id, role, name, email)
        values (${userId}, 'partner', 'Parceiro', 'par@teste.local')`;

      const claims = await emitir(tx, userId, { sub: userId });
      await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      const [lido] = await tx<{ papel: string; empresa: string | null }[]>`
        select auth_role() as papel, auth_org_id() as empresa`;

      expect(lido.papel).toBe("partner");
      expect(lido.empresa).toBeNull();
    });
  });
});
