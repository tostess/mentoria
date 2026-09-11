import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { orgs } from "./orgs";
import { ledgerType, userRole } from "./enums";
import { isAdmin } from "./auth";

/**
 * Toda pessoa da plataforma, em qualquer papel. A identidade fica em
 * `auth.users`; aqui fica o perfil.
 *
 * Invariante 9 escrita no esquema: só Profissional e RH pertencem a uma
 * empresa. Parceiro e operadora têm `org_id` nulo — são da plataforma.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => orgs.id),
    role: userRole("role").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    photoUrl: text("photo_url"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    jobTitle: text("job_title"),
    area: text("area"),
    phone: text("phone"),
    notifPrefs: jsonb("notif_prefs")
      .notNull()
      .default(sql`'{"email":true,"whatsapp":false}'::jsonb`),
    active: boolean("active").notNull().default(true),
    /** LGPD: exclusão marca aqui e anonimiza; livros-caixa permanecem. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "profiles_org_scope",
      sql`(${t.role} in ('professional','org_admin')) = (${t.orgId} is not null)`,
    ),
    /**
     * Colegas de empresa, o próprio registro, e o perfil de qualquer Parceiro
     * ativo — este último porque `partners` é visível a todas as empresas
     * (invariante 9) e o nome do Parceiro mora aqui. Sem ele a busca da
     * Etapa P4 devolveria Parceiros sem nome.
     */
    pgPolicy("profiles_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        ${isAdmin()}
        or ${t.id} = auth.uid()
        or (${t.orgId} is not null and ${t.orgId} = auth_org_id())
        or exists (
          select 1 from partners p
           where p.id = profiles.id and p.status = 'active'
        )`,
    }),
    /** O próprio perfil. `role` e `org_id` são travados por trigger. */
    pgPolicy("profiles_update_self", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = auth.uid()`,
      withCheck: sql`${t.id} = auth.uid()`,
    }),
  ],
);

/**
 * Carteira do Profissional. Invariante 3: `balance` é mantido por trigger a
 * partir de `wallet_ledger` e protegido por `check (balance >= 0)`.
 * Invariante 13: ficha não é comprável nem transferível.
 */
export const wallets = pgTable(
  "wallets",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    balance: integer("balance").notNull().default(0),
    lastEntryAt: timestamp("last_entry_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    check("wallets_balance_nonneg", sql`${t.balance} >= 0`),
    /**
     * Só a própria carteira. O RH não vê saldo individual — vê `org_usage`
     * agregado (invariante 10). Nenhuma policy de escrita (invariante 4).
     */
    pgPolicy("wallets_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = auth.uid()`,
    }),
  ],
);

/**
 * Livro-caixa do Profissional. Append-only por trigger; `balance` sai daqui.
 * Invariante 4: nenhuma policy de `insert`, `update` ou `delete`.
 */
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => wallets.userId, { onDelete: "restrict" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    type: ledgerType("type").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    bookingId: uuid("booking_id"),
    byUserId: uuid("by_user_id"),
    reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("wallet_ledger_amount_nonzero", sql`${t.amount} <> 0`),
    pgPolicy("wallet_ledger_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = auth.uid()`,
    }),
  ],
);
