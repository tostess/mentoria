/**
 * Esquema Drizzle — fonte da verdade do banco.
 *
 * Ordem dos módulos = ordem de dependência: empresas, pessoas, Parceiros,
 * sessões, engajamento, plataforma.
 *
 * O que **não** mora aqui, por o Drizzle não modelar, e vive em migração
 * escrita à mão (`supabase/migrations/*_invariantes.sql`):
 *
 * - `btree_gist` e a constraint de exclusão de `bookings` — invariante 7
 * - triggers de saldo e de imutabilidade dos livros-caixa — invariante 3
 * - `auth_role()` e `auth_org_id()` — invariante 19
 * - privilégio de coluna que impede o Parceiro de mexer no próprio `status`
 * - a view `org_usage` — o único recorte que o RH enxerga (invariante 10)
 */

export * from "./enums";
export * from "./orgs";
export * from "./people";
export * from "./partners";
export * from "./sessions";
export * from "./engagement";
export * from "./platform";
