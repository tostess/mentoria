import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { ledgerType, orgKind } from "./enums";
import { isAdmin, isStaff } from "./auth";

/**
 * A conta que paga as fichas. `empresa` é a contratante, que compra um bloco e
 * distribui; `individual` é a conta pessoal do avulso, que compra pacotes e é o
 * único membro dela (o trigger `trg_profiles_individual_org` garante).
 *
 * Invariante 9 continua de pé sem caso especial: o avulso é uma empresa de uma
 * pessoa, e a RLS por `auth_org_id()` o isola como isola qualquer empresa.
 */
export const orgs = pgTable(
  "orgs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: orgKind("kind").notNull().default("empresa"),
    name: text("name").notNull(),
    cnpj: text("cnpj"),
    /**
     * Só da conta pessoal, pedido na primeira compra (o gateway e a NFS-e
     * exigem). Único entre contas pessoais: uma por pessoa.
     */
    cpf: text("cpf"),
    active: boolean("active").notNull().default(true),
    contractedFichas: integer("contracted_fichas").notNull().default(0),
    contractStart: date("contract_start"),
    contractEnd: date("contract_end"),
    /** `accent` e logotipo — o produto é white-label. */
    branding: jsonb("branding"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("orgs_contracted_fichas_nonneg", sql`${t.contractedFichas} >= 0`),
    check("orgs_cnpj_so_empresa", sql`${t.kind} = 'empresa' or ${t.cnpj} is null`),
    check("orgs_cpf_so_individual", sql`${t.kind} = 'individual' or ${t.cpf} is null`),
    uniqueIndex("orgs_cpf_individual_uq")
      .on(t.cpf)
      .where(sql`${t.kind} = 'individual'`),
    // O RH vê a própria empresa; a operadora vê todas. Escrita é só do
    // `service_role`: contrato não se edita pelo cliente.
    pgPolicy("orgs_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${isAdmin()} or ${t.id} = auth_org_id()`,
    }),
  ],
);

/**
 * Saldo do contrato. Invariante 3: mantido por trigger a partir do livro-caixa
 * e protegido por `check (balance >= 0)` — o débito indevido derruba a
 * transação no banco, não no código.
 */
export const orgWallets = pgTable(
  "org_wallets",
  {
    orgId: uuid("org_id")
      .primaryKey()
      .references(() => orgs.id, { onDelete: "restrict" }),
    balance: integer("balance").notNull().default(0),
    lastEntryAt: timestamp("last_entry_at", { withTimezone: true }),
  },
  (t) => [
    check("org_wallets_balance_nonneg", sql`${t.balance} >= 0`),
    pgPolicy("org_wallets_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${isAdmin()} or ${t.orgId} = auth_org_id()`,
    }),
  ],
);

/**
 * Livro-caixa da empresa. Invariante 3: append-only, com trigger que bloqueia
 * `update` e `delete`. Invariante 4: sem policy de escrita para papel
 * autenticado — toda entrada passa por Route Handler com `service_role`.
 *
 * Invariante 16: `idempotency_key` única faz o trabalho agendado poder repetir
 * sem duplicar lançamento.
 */
export const orgLedger = pgTable(
  "org_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    type: ledgerType("type").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    toUserId: uuid("to_user_id"),
    byUserId: uuid("by_user_id"),
    reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("org_ledger_amount_nonzero", sql`${t.amount} <> 0`),
    pgPolicy("org_ledger_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${isStaff()} or ${t.orgId} = auth_org_id()`,
    }),
  ],
);
