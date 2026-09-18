/**
 * O que a aplicação sabe sobre quem está logado — e de onde sabe.
 *
 * Invariante 19: papel e `org_id` são lidos do JWT, nunca de campo de tabela.
 * Quem escreve as claims é o `custom_access_token_hook`, no banco, na emissão
 * do token. Se viessem de `profiles` a cada requisição, quem conseguisse
 * escrever no próprio perfil escalaria papel — e a RLS já confia no JWT.
 *
 * Módulo puro: sem rede, sem banco, sem `next/*`. É o que permite testá-lo
 * inteiro e importá-lo tanto do `proxy.ts` quanto de um Server Component.
 */

export const ROLES = ["admin", "moderator", "org_admin", "partner", "professional"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Invariante 9: só Profissional e RH pertencem a uma empresa. Parceiro,
 * operadora e moderação são da plataforma e não têm `org_id`.
 *
 * A mesma regra está no banco, como `check` de `profiles`. Aqui ela serve
 * para rejeitar token incoerente — que só existe se for forjado ou se o
 * esquema tiver sido burlado.
 */
export const ORG_SCOPED_ROLES: readonly Role[] = ["professional", "org_admin"];

export type Session = {
  userId: string;
  role: Role;
  /** Sempre null para papéis de plataforma. */
  orgId: string | null;
  email: string | null;
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Claims verificadas → sessão, ou null quando não há acesso.
 *
 * Recebe `unknown` de propósito: o `getClaims()` do Supabase devolve um
 * payload com índice aberto, e o contrato do projeto é não ter `any`. A
 * validação acontece aqui, uma vez, e o resto do código recebe `Session`.
 *
 * Devolve null em três situações, todas equivalentes para quem chama — sem
 * acesso:
 *
 * 1. Sem `user_role`. É como o hook trata pessoa inativa ou excluída: não
 *    escreve a claim. Sem ela, toda policy da Etapa 3 nega sozinha; aqui a
 *    interface acompanha o banco em vez de contradizê-lo.
 * 2. Papel desconhecido — token de uma versão do enum que não existe mais.
 * 3. `org_id` incoerente com o papel. Token coerente não tem como chegar
 *    assim: o `check` de `profiles` impede a linha que o geraria.
 */
export function parseClaims(claims: unknown): Session | null {
  if (typeof claims !== "object" || claims === null) return null;
  const record = claims as Record<string, unknown>;

  const userId = text(record.sub);
  if (userId === null || !UUID.test(userId)) return null;

  if (!isRole(record.user_role)) return null;
  const role = record.user_role;

  const orgId = text(record.org_id);
  if (orgId !== null && !UUID.test(orgId)) return null;
  if (ORG_SCOPED_ROLES.includes(role) !== (orgId !== null)) return null;

  return { userId, role, orgId, email: text(record.email) };
}
