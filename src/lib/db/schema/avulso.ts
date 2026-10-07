import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers, authenticatedRole } from "drizzle-orm/supabase";
import { orgs } from "./orgs";
import { profiles, wallets } from "./people";
import { isStaff } from "./auth";

/**
 * O Profissional avulso (diretriz de 01/10/2026): o pedido de cadastro, o
 * pagamento e o lote de fichas que o pagamento cria.
 *
 * Nenhuma das três tem policy de escrita para papel autenticado, e a migração
 * ainda revoga o privilégio (invariante 4 estendida): o pedido é gravado pela
 * Server Action do cadastro, o pagamento e o lote pela transação do crédito,
 * todos com conexão de servidor.
 */

/**
 * O pedido de cadastro do avulso, até a operadora decidir.
 *
 * `user_id` aponta para a identidade criada no `signUp` e é anulado se ela for
 * apagada (recusa): o pedido recusado fica, para a fila mostrar a decisão, e é
 * anonimizado depois. Enquanto pendente não existe perfil, logo não existe
 * `user_role` no token — e sem ele toda policy nega.
 *
 * Leitura só da equipe da operadora, como `partner_applications`.
 */
export const individualSignups = pgTable(
  "individual_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    jobTitle: text("job_title"),
    area: text("area"),
    linkedin: text("linkedin"),
    /** O que a pessoa busca na mentoria — é o que a operadora lê para decidir. */
    goal: text("goal"),
    /** A versão dos termos que a pessoa aceitou ao se cadastrar. */
    termsVersion: text("terms_version"),
    status: text("status").notNull().default("pending"),
    /** Interno: a pessoa recusada recebe e-mail neutro, sem o motivo. */
    rejectReason: text("reject_reason"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /**
     * Quando o pedido recusado perdeu os dados pessoais (LGPD: 90 dias depois
     * da recusa). A linha fica — a fila e a auditoria contam que houve um
     * pedido e uma decisão —, mas sem nome, contato nem o que a pessoa escreveu.
     */
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("individual_signups_status", sql`${t.status} in ('pending','approved','rejected')`),
    // Só pedido recusado é anonimizado; o aprovado virou conta e segue as regras dela.
    check(
      "individual_signups_anon_rejected",
      sql`${t.anonymizedAt} is null or ${t.status} = 'rejected'`,
    ),
    // Um pedido aberto por e-mail: o segundo envio do formulário não vira
    // segunda linha na fila.
    uniqueIndex("individual_signups_email_pending_uq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.status} = 'pending'`),
    index("individual_signups_status_idx").on(t.status, t.createdAt),
    pgPolicy("individual_signups_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isStaff(),
    }),
  ],
);

/**
 * Uma compra de pacote pelo avulso.
 *
 * `amount_cents` congela o preço do momento: mudar a tabela de pacotes em
 * `app_config` não mexe em compra feita. `provider` é `asaas` quando a pessoa
 * pagou pelo checkout e `manual` quando a operadora registrou um pagamento
 * recebido fora da plataforma — nos dois casos `provider_payment_id` é único,
 * e é ele que impede o mesmo pagamento de virar dois créditos.
 *
 * A ficha não nasce aqui: nasce quando a transação do crédito passa o status a
 * `confirmed` e lança `purchase` + `allocate` com a chave `pay_{id}`.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    packageId: text("package_id").notNull(),
    fichas: integer("fichas").notNull(),
    amountCents: integer("amount_cents").notNull(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").unique(),
    providerCustomerId: text("provider_customer_id"),
    method: text("method"),
    status: text("status").notNull().default("pending"),
    invoiceUrl: text("invoice_url"),
    /** Texto livre da operadora no registro manual: "Pix de 02/10", nº do comprovante. */
    reference: text("reference"),
    createdBy: uuid("created_by"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("payments_fichas_pos", sql`${t.fichas} > 0`),
    check("payments_amount_nonneg", sql`${t.amountCents} >= 0`),
    check("payments_provider", sql`${t.provider} in ('asaas','manual')`),
    check(
      "payments_status",
      sql`${t.status} in ('pending','confirmed','refunded','failed','expired')`,
    ),
    index("payments_user_idx").on(t.userId, t.createdAt),
    index("payments_status_idx").on(t.status, t.createdAt),
    pgPolicy("payments_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = auth.uid() or ${isStaff()}`,
    }),
  ],
);

/**
 * O lote de fichas que um pagamento confirmado criou, com a validade dele.
 *
 * **Não tem coluna de restante.** O que sobra de um lote é
 * `sum(amount) from wallet_ledger where lot_id = …` — derivado do livro-caixa,
 * como o saldo (invariante 3). Uma coluna mantida à mão divergiria do
 * livro-caixa na primeira transação esquecida, e a baixa do vencimento tiraria
 * da carteira um número que não existe.
 *
 * Imutável por trigger, como os livros-caixa. `unique (id, user_id)` existe para
 * a FK composta de `wallet_ledger`: lançamento só aponta para lote do próprio
 * dono.
 */
export const fichaLots = pgTable(
  "ficha_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => wallets.userId, { onDelete: "restrict" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .unique()
      .references(() => payments.id, { onDelete: "restrict" }),
    fichas: integer("fichas").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ficha_lots_fichas_pos", sql`${t.fichas} > 0`),
    unique("ficha_lots_id_user_uq").on(t.id, t.userId),
    index("ficha_lots_user_idx").on(t.userId, t.expiresAt),
    pgPolicy("ficha_lots_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = auth.uid() or ${isStaff()}`,
    }),
  ],
);
