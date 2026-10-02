import { pgEnum } from "drizzle-orm/pg-core";

/** Papéis. `org_admin` é o RH; `partner` é o Parceiro de Desenvolvimento. */
export const userRole = pgEnum("user_role", [
  "admin",
  "moderator",
  "org_admin",
  "partner",
  "professional",
]);

/** Invariante 8: o Parceiro entra por convite e só o admin move para `active`. */
export const partnerStatus = pgEnum("partner_status", [
  "invited",
  "onboarding",
  "pending_review",
  "active",
  "paused",
  "archived",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "done",
  "cancelled",
  "no_show_professional",
  "no_show_partner",
  "expired",
]);

/**
 * Tipos de lançamento do livro-caixa. Invariante 3: correção é `adjust`.
 *
 * `expire` é a baixa do que sobrou de um lote comprado pelo avulso quando ele
 * vence (12 meses). Ficha de empresa não tem lote e não vence.
 */
export const ledgerType = pgEnum("ledger_type", [
  "purchase",
  "allocate",
  "spend",
  "refund",
  "gift",
  "reclaim",
  "adjust",
  "expire",
]);

/**
 * O tipo de conta. `empresa` é o contrato B2B, com RH e colaboradores;
 * `individual` é a conta pessoal do Profissional avulso — uma `org` de um só,
 * que é o que deixa RLS, carteira e reserva valerem sem caso especial.
 */
export const orgKind = pgEnum("org_kind", ["empresa", "individual"]);

export const engagementType = pgEnum("engagement_type", [
  "voluntario",
  "parceria",
  "remunerado",
]);
