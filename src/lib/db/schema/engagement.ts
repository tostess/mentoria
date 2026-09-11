import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { orgs } from "./orgs";
import { profiles } from "./people";
import { partners } from "./partners";
import { bookings } from "./sessions";
import { isStaff } from "./auth";

/**
 * Quota mensal de presente e de extensão do Parceiro. `period` é `YYYYMM`:
 * a quota **não acumula**, então o período é parte da chave e o mês novo
 * começa zerado sem precisar de job de reset.
 */
export const giftQuotas = pgTable(
  "gift_quotas",
  {
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    giftsUsed: integer("gifts_used").notNull().default(0),
    extensionsUsed: integer("extensions_used").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.partnerId, t.period] }),
    check("gift_quotas_period_format", sql`${t.period} ~ '^[0-9]{6}$'`),
    check("gift_quotas_gifts_nonneg", sql`${t.giftsUsed} >= 0`),
    check("gift_quotas_extensions_nonneg", sql`${t.extensionsUsed} >= 0`),
    pgPolicy("gift_quotas_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.partnerId} = auth.uid() or ${isStaff()}`,
    }),
  ],
);

/**
 * Horas doadas ou contratadas. A plataforma acompanha, mas **não processa
 * pagamento** — é registro, não folha.
 */
export const partnerHours = pgTable(
  "partner_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id),
    minutes: integer("minutes").notNull(),
    kind: text("kind").notNull().default("session"),
    occurredOn: date("occurred_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("partner_hours_minutes_positive", sql`${t.minutes} > 0`),
    check("partner_hours_kind", sql`${t.kind} in ('session','prep','other')`),
    pgPolicy("partner_hours_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.partnerId} = auth.uid() or ${isStaff()}`,
    }),
  ],
);

/** Objetivo do Profissional. Escopo da empresa (invariante 9). */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    targetDate: date("target_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("goals_status", sql`${t.status} in ('active','done','dropped')`),
    // Invariante 10: é conteúdo do Profissional, o RH não lê.
    pgPolicy("goals_own", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid()`,
      withCheck: sql`${t.professionalId} = auth.uid()`,
    }),
  ],
);

/** Check-in 7 dias depois da sessão — mede se a conversa virou ação. */
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    progress: smallint("progress"),
    note: text("note"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("checkins_progress_range", sql`${t.progress} between 1 and 5`),
    pgPolicy("checkins_own", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid()`,
      withCheck: sql`${t.professionalId} = auth.uid()`,
    }),
  ],
);

/** Invariante 16: `idempotency_key` impede o cron de notificar duas vezes. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    payload: jsonb("payload"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("notifications_channel", sql`${t.channel} in ('email','whatsapp','inapp')`),
    pgPolicy("notifications_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = auth.uid()`,
    }),
    // Só marcar como lida; o resto é do `service_role`.
    pgPolicy("notifications_update_self", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} = auth.uid()`,
      withCheck: sql`${t.userId} = auth.uid()`,
    }),
  ],
);

/** Fila de espera por um Parceiro sem vaga. */
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    desiredFrom: timestamp("desired_from", { withTimezone: true }),
    desiredTo: timestamp("desired_to", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("waitlist_select_participants", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid() or ${t.partnerId} = auth.uid()`,
    }),
    pgPolicy("waitlist_write_own", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid()`,
      withCheck: sql`${t.professionalId} = auth.uid()`,
    }),
  ],
);

/**
 * Pergunta assíncrona, dentro da janela de 24h depois da sessão. Chat livre
 * fora dessa janela foi descartado — `expires_at` é o que garante isso.
 */
export const asyncQuestions = pgTable(
  "async_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Invariante 10: conteúdo de sessão, o RH não lê.
    pgPolicy("async_questions_select_participants", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid() or ${t.partnerId} = auth.uid()`,
    }),
  ],
);

/**
 * Invariante 14: o assistente recomenda **pessoas**, nunca horários.
 * Invariante 15: o sinal de demanda que sai daqui é agregado e anônimo — por
 * isso não existe policy de leitura para papel autenticado.
 */
export const suggestionEvents = pgTable(
  "suggestion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    context: jsonb("context"),
    suggestedPartnerIds: uuid("suggested_partner_ids").array(),
    chosenPartnerId: uuid("chosen_partner_id").references(() => partners.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("suggestion_events_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isStaff(),
    }),
  ],
);
