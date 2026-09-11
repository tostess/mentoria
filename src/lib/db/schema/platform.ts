import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  check,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { orgs } from "./orgs";
import { profiles } from "./people";
import { bookings } from "./sessions";
import { userRole } from "./enums";
import { isStaff } from "./auth";

/** Denúncia sobre uma sessão ou pessoa. Vai para a fila da moderação. */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id),
    targetUserId: uuid("target_user_id").references(() => profiles.id),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("reports_status", sql`${t.status} in ('open','reviewing','resolved','dismissed')`),
    /** Quem denunciou acompanha a própria denúncia; a moderação vê todas. */
    pgPolicy("reports_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.reporterId} = auth.uid() or ${isStaff()}`,
    }),
    pgPolicy("reports_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.reporterId} = auth.uid()`,
    }),
  ],
);

/**
 * Fila de decisões da operadora: candidatura, denúncia, avaliação sinalizada.
 * `ref_id` aponta para a tabela indicada por `kind` — polimórfico de
 * propósito, para a fila não crescer uma coluna por tipo novo.
 */
export const moderationQueue = pgTable(
  "moderation_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    refId: uuid("ref_id").notNull(),
    status: text("status").notNull().default("pending"),
    assignedTo: uuid("assigned_to"),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("moderation_queue_kind", sql`${t.kind} in ('partner_application','report','review')`),
    check("moderation_queue_status", sql`${t.status} in ('pending','in_review','done','dismissed')`),
    index("moderation_queue_status_idx").on(t.status, t.createdAt),
    pgPolicy("moderation_queue_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isStaff(),
    }),
  ],
);

/**
 * Configuração da plataforma: `ficha_policy`, `copy.terms`, `copy.legal`,
 * `flags`. Legível por qualquer autenticado — é daqui que sai o vocabulário
 * da interface. Escrita só `service_role`.
 */
export const appConfig = pgTable(
  "app_config",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    updatedBy: uuid("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("app_config_select_all", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
);

/**
 * Invariante 12: toda ação de admin, moderador ou RH grava aqui.
 * Invariante 18: a correção de presença pelo Parceiro também.
 *
 * LGPD: sobrevive à exclusão de conta — é registro imutável, não dado de
 * perfil. Sem policy de escrita: quem grava é o `service_role`.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    actorRole: userRole("actor_role"),
    orgId: uuid("org_id").references(() => orgs.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entity, t.entityId, t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId, t.createdAt),
    pgPolicy("audit_logs_select_staff", {
      for: "select",
      to: authenticatedRole,
      using: isStaff(),
    }),
  ],
);
