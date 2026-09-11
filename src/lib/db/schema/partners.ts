import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { engagementType, partnerStatus } from "./enums";
import { profiles } from "./people";
import { isStaff } from "./auth";

/**
 * Parceiro de Desenvolvimento. Invariante 9: pertence à **plataforma**, não a
 * uma empresa — por isso não tem `org_id` e é visível a todas as contratantes.
 *
 * Invariante 8: nunca se autocadastra. Entra `invited` e só o admin move para
 * `active`. A coluna `status` é protegida por privilégio de coluna, concedido
 * na migração à mão: RLS não restringe coluna.
 */
export const partners = pgTable(
  "partners",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: partnerStatus("status").notNull().default("invited"),
    headline: text("headline"),
    bio: text("bio"),
    areas: text("areas").array().notNull().default(sql`'{}'`),
    skills: text("skills").array().notNull().default(sql`'{}'`),
    seniority: text("seniority"),
    /** Minutos de descanso entre sessões. Entra no motor da Etapa 5. */
    bufferMin: integer("buffer_min").notNull().default(15),
    maxPerWeek: integer("max_per_week").notNull().default(4),
    autoConfirm: boolean("auto_confirm").notNull().default(false),
    engagement: engagementType("engagement").notNull().default("voluntario"),
    contractedHoursMonthly: numeric("contracted_hours_monthly"),
    /** Invariante 20: presentear ou estender — escolhe um, dentro da sala. */
    giftQuotaMonthly: integer("gift_quota_monthly").notNull().default(3),
    extensionQuotaMonthly: integer("extension_quota_monthly").notNull().default(3),
    ratingAvg: numeric("rating_avg"),
    ratingCount: integer("rating_count").notNull().default(0),
    sessionCount: integer("session_count").notNull().default(0),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    check("partners_buffer_nonneg", sql`${t.bufferMin} >= 0`),
    check("partners_max_per_week_positive", sql`${t.maxPerWeek} > 0`),
    /** Ativo é público entre autenticados; qualquer status, só o dono e a operadora. */
    pgPolicy("partners_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.status} = 'active' or ${t.id} = auth.uid() or ${isStaff()}`,
    }),
    pgPolicy("partners_update_self", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = auth.uid()`,
      withCheck: sql`${t.id} = auth.uid()`,
    }),
  ],
);

/**
 * Regra semanal de disponibilidade. Invariante 2: minutos desde a meia-noite
 * **no fuso do Parceiro** — o fuso vem de `profiles.timezone`. Nada de
 * `timestamptz` aqui: a regra é "toda terça das 9h às 12h", não um instante.
 */
export const partnerRules = pgTable(
  "partner_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    /** 0 = domingo. */
    weekday: smallint("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
  },
  (t) => [
    check("partner_rules_weekday_range", sql`${t.weekday} between 0 and 6`),
    check("partner_rules_start_range", sql`${t.startMin} between 0 and 1440`),
    check("partner_rules_end_range", sql`${t.endMin} between 0 and 1440`),
    check("partner_rules_order", sql`${t.endMin} > ${t.startMin}`),
    pgPolicy("partner_rules_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        ${isStaff()}
        or ${t.partnerId} = auth.uid()
        or exists (
          select 1 from partners p
           where p.id = partner_rules.partner_id and p.status = 'active'
        )`,
    }),
    pgPolicy("partner_rules_write_self", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.partnerId} = auth.uid()`,
      withCheck: sql`${t.partnerId} = auth.uid()`,
    }),
  ],
);

/** Folga pontual (`block`) ou horário extra (`extra`) num dia específico. */
export const partnerExceptions = pgTable(
  "partner_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    kind: text("kind").notNull(),
    startMin: integer("start_min"),
    endMin: integer("end_min"),
    reason: text("reason"),
  },
  (t) => [
    check("partner_exceptions_kind", sql`${t.kind} in ('block','extra')`),
    pgPolicy("partner_exceptions_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        ${isStaff()}
        or ${t.partnerId} = auth.uid()
        or exists (
          select 1 from partners p
           where p.id = partner_exceptions.partner_id and p.status = 'active'
        )`,
    }),
    pgPolicy("partner_exceptions_write_self", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.partnerId} = auth.uid()`,
      withCheck: sql`${t.partnerId} = auth.uid()`,
    }),
  ],
);

/** Invariante 8: o único caminho de entrada de um Parceiro. */
export const partnerInvites = pgTable(
  "partner_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    email: text("email").notNull(),
    phone: text("phone"),
    area: text("area"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    // Leitura só da operadora. Quem chega pelo convite não está autenticado:
    // a troca do token acontece em Route Handler com `service_role`.
    pgPolicy("partner_invites_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isStaff(),
    }),
  ],
);

/** Candidatura espontânea. Invariante 8: só vira Parceiro por decisão do admin. */
export const partnerApplications = pgTable(
  "partner_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contact: text("contact").notNull(),
    pitch: text("pitch"),
    linkedin: text("linkedin"),
    status: text("status").notNull().default("pending"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("partner_applications_status", sql`${t.status} in ('pending','approved','rejected')`),
    pgPolicy("partner_applications_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isStaff(),
    }),
  ],
);
