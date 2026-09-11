import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { bookingStatus } from "./enums";
import { orgs } from "./orgs";
import { profiles } from "./people";
import { partners } from "./partners";
import { isStaff } from "./auth";

/**
 * A sessão. Invariante 7: sobreposição é impedida pelo **banco**, por uma
 * constraint de exclusão sobre `(partner_id, tstzrange(start_at, end_at))`
 * para status ativos — criada na migração à mão porque o Drizzle não modela
 * `exclude using gist`. Ela cobre inclusive a sessão estendida para 60 min.
 *
 * Invariante 4: nenhuma policy de escrita. Reserva é transação SQL com
 * `service_role` (invariante 6).
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    /** Invariante 20: minutos somados dentro da sala. Não custa ficha. */
    extendedBy: integer("extended_by").notNull().default(0),
    priceFichas: integer("price_fichas").notNull().default(1),
    status: bookingStatus("status").notNull().default("pending"),
    /** Invariante 18: presença é derivada da sala; o Parceiro só corrige. */
    attendedPartner: boolean("attended_partner"),
    attendedProfessional: boolean("attended_professional"),
    roomName: text("room_name"),
    createdVia: text("created_via").notNull().default("search"),
    briefingId: uuid("briefing_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("bookings_interval", sql`${t.endAt} > ${t.startAt}`),
    index("bookings_professional_start_idx").on(t.professionalId, t.startAt),
    index("bookings_org_start_idx").on(t.orgId, t.startAt),
    /**
     * Invariante 10: **nenhuma policy para `org_admin`**. O RH não lê sessão,
     * e não é por esquecermos de filtrar — é por não existir policy que o
     * deixe entrar. Sem isso ninguém usa a plataforma com sinceridade.
     */
    pgPolicy("bookings_select_participants", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid() or ${t.partnerId} = auth.uid() or ${isStaff()}`,
    }),
  ],
);

/** Invariante 11: a sala não abre sem isto. */
export const briefings = pgTable(
  "briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id),
    goal: text("goal").notNull(),
    context: text("context"),
    questions: text("questions"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Invariante 10 de novo: o RH não vê conteúdo de sessão.
    pgPolicy("briefings_select_participants", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        exists (
          select 1 from bookings b
           where b.id = briefings.booking_id
             and (b.professional_id = auth.uid() or b.partner_id = auth.uid())
        )`,
    }),
    pgPolicy("briefings_write_own", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid()`,
      withCheck: sql`${t.professionalId} = auth.uid()`,
    }),
  ],
);

/**
 * Invariante 18: gravado pelo webhook do Daily. O Parceiro nunca escreve aqui
 * — ele corrige `bookings.attended_*`, e a correção grava `audit_logs`.
 */
export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    kind: text("kind").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("session_events_select_participants", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        ${isStaff()}
        or exists (
          select 1 from bookings b
           where b.id = session_events.booking_id
             and (b.professional_id = auth.uid() or b.partner_id = auth.uid())
        )`,
    }),
  ],
);

/** Avaliação do Profissional sobre a sessão. Uma por sessão. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => profiles.id),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    pgPolicy("reviews_select_participants", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.professionalId} = auth.uid() or ${t.partnerId} = auth.uid() or ${isStaff()}`,
    }),
    pgPolicy("reviews_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.professionalId} = auth.uid()`,
    }),
  ],
);
