import { sql } from "drizzle-orm";

/**
 * Invariante 19: papel e `org_id` saem do JWT, nunca de campo de tabela. Se
 * viessem da tabela, quem conseguisse escrever em `profiles` escalaria papel.
 *
 * As duas funções são criadas em migração à mão — o Drizzle não modela função
 * SQL. São `stable`, então o Postgres avalia uma vez por statement e o custo
 * de tê-las dentro de toda policy é desprezível.
 */
export const authRole = () => sql`auth_role()`;
export const authOrgId = () => sql`auth_org_id()`;

/** A operadora enxerga tudo. */
export const isAdmin = () => sql`auth_role() = 'admin'`;
/** Operadora e delegado dela — fila, denúncias, moderação. */
export const isStaff = () => sql`auth_role() in ('admin','moderator')`;
/** Registro da própria empresa de quem está logado. */
export const sameOrg = (column: string) => sql.raw(`${column} = auth_org_id()`);
/** O próprio usuário. */
export const isSelf = (column: string) => sql.raw(`${column} = auth.uid()`);
