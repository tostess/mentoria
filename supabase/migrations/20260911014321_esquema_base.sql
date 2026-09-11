CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'done', 'cancelled', 'no_show_professional', 'no_show_partner', 'expired');--> statement-breakpoint
CREATE TYPE "public"."engagement_type" AS ENUM('voluntario', 'parceria', 'remunerado');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('purchase', 'allocate', 'spend', 'refund', 'gift', 'reclaim', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('invited', 'onboarding', 'pending_review', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'moderator', 'org_admin', 'partner', 'professional');--> statement-breakpoint
CREATE TABLE "org_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"to_user_id" uuid,
	"by_user_id" uuid,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "org_ledger_amount_nonzero" CHECK ("org_ledger"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "org_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_wallets" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"last_entry_at" timestamp with time zone,
	CONSTRAINT "org_wallets_balance_nonneg" CHECK ("org_wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "org_wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cnpj" text,
	"active" boolean DEFAULT true NOT NULL,
	"contracted_fichas" integer DEFAULT 0 NOT NULL,
	"contract_start" date,
	"contract_end" date,
	"branding" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_contracted_fichas_nonneg" CHECK ("orgs"."contracted_fichas" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orgs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"photo_url" text,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"job_title" text,
	"area" text,
	"phone" text,
	"notif_prefs" jsonb DEFAULT '{"email":true,"whatsapp":false}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_org_scope" CHECK (("profiles"."role" in ('professional','org_admin')) = ("profiles"."org_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"booking_id" uuid,
	"by_user_id" uuid,
	"reason" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "wallet_ledger_amount_nonzero" CHECK ("wallet_ledger"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "wallet_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"last_entry_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "wallets_balance_nonneg" CHECK ("wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"pitch" text,
	"linkedin" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_applications_status" CHECK ("partner_applications"."status" in ('pending','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "partner_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"start_min" integer,
	"end_min" integer,
	"reason" text,
	CONSTRAINT "partner_exceptions_kind" CHECK ("partner_exceptions"."kind" in ('block','extra'))
);
--> statement-breakpoint
ALTER TABLE "partner_exceptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"area" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "partner_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"effective_from" date,
	"effective_to" date,
	CONSTRAINT "partner_rules_weekday_range" CHECK ("partner_rules"."weekday" between 0 and 6),
	CONSTRAINT "partner_rules_start_range" CHECK ("partner_rules"."start_min" between 0 and 1440),
	CONSTRAINT "partner_rules_end_range" CHECK ("partner_rules"."end_min" between 0 and 1440),
	CONSTRAINT "partner_rules_order" CHECK ("partner_rules"."end_min" > "partner_rules"."start_min")
);
--> statement-breakpoint
ALTER TABLE "partner_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "partner_status" DEFAULT 'invited' NOT NULL,
	"headline" text,
	"bio" text,
	"areas" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"seniority" text,
	"buffer_min" integer DEFAULT 15 NOT NULL,
	"max_per_week" integer DEFAULT 4 NOT NULL,
	"auto_confirm" boolean DEFAULT false NOT NULL,
	"engagement" "engagement_type" DEFAULT 'voluntario' NOT NULL,
	"contracted_hours_monthly" numeric,
	"gift_quota_monthly" integer DEFAULT 3 NOT NULL,
	"extension_quota_monthly" integer DEFAULT 3 NOT NULL,
	"rating_avg" numeric,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	CONSTRAINT "partners_buffer_nonneg" CHECK ("partners"."buffer_min" >= 0),
	CONSTRAINT "partners_max_per_week_positive" CHECK ("partners"."max_per_week" > 0)
);
--> statement-breakpoint
ALTER TABLE "partners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 30 NOT NULL,
	"extended_by" integer DEFAULT 0 NOT NULL,
	"price_fichas" integer DEFAULT 1 NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"attended_partner" boolean,
	"attended_professional" boolean,
	"room_name" text,
	"created_via" text DEFAULT 'search' NOT NULL,
	"briefing_id" uuid,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_interval" CHECK ("bookings"."end_at" > "bookings"."start_at")
);
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"context" text,
	"questions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "briefings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "async_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"booking_id" uuid,
	"question" text NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "async_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"progress" smallint,
	"note" text,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "checkins_progress_range" CHECK ("checkins"."progress" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gift_quotas" (
	"partner_id" uuid NOT NULL,
	"period" text NOT NULL,
	"gifts_used" integer DEFAULT 0 NOT NULL,
	"extensions_used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "gift_quotas_partner_id_period_pk" PRIMARY KEY("partner_id","period"),
	CONSTRAINT "gift_quotas_period_format" CHECK ("gift_quotas"."period" ~ '^[0-9]{6}$'),
	CONSTRAINT "gift_quotas_gifts_nonneg" CHECK ("gift_quotas"."gifts_used" >= 0),
	CONSTRAINT "gift_quotas_extensions_nonneg" CHECK ("gift_quotas"."extensions_used" >= 0)
);
--> statement-breakpoint
ALTER TABLE "gift_quotas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_status" CHECK ("goals"."status" in ('active','done','dropped'))
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"payload" jsonb,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "notifications_channel" CHECK ("notifications"."channel" in ('email','whatsapp','inapp'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"booking_id" uuid,
	"minutes" integer NOT NULL,
	"kind" text DEFAULT 'session' NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_hours_minutes_positive" CHECK ("partner_hours"."minutes" > 0),
	CONSTRAINT "partner_hours_kind" CHECK ("partner_hours"."kind" in ('session','prep','other'))
);
--> statement-breakpoint
ALTER TABLE "partner_hours" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suggestion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"context" jsonb,
	"suggested_partner_ids" uuid[],
	"chosen_partner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suggestion_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"desired_from" timestamp with time zone,
	"desired_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" "user_role",
	"org_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "moderation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_queue_kind" CHECK ("moderation_queue"."kind" in ('partner_application','report','review')),
	CONSTRAINT "moderation_queue_status" CHECK ("moderation_queue"."status" in ('pending','in_review','done','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "moderation_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"reporter_id" uuid NOT NULL,
	"target_user_id" uuid,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_status" CHECK ("reports"."status" in ('open','reviewing','resolved','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_ledger" ADD CONSTRAINT "org_ledger_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_wallets" ADD CONSTRAINT "org_wallets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_user_id_wallets_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wallets"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_exceptions" ADD CONSTRAINT "partner_exceptions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_rules" ADD CONSTRAINT "partner_rules_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_id_profiles_id_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_questions" ADD CONSTRAINT "async_questions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_questions" ADD CONSTRAINT "async_questions_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_questions" ADD CONSTRAINT "async_questions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_questions" ADD CONSTRAINT "async_questions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_quotas" ADD CONSTRAINT "gift_quotas_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_hours" ADD CONSTRAINT "partner_hours_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_hours" ADD CONSTRAINT "partner_hours_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_events" ADD CONSTRAINT "suggestion_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_events" ADD CONSTRAINT "suggestion_events_chosen_partner_id_partners_id_fk" FOREIGN KEY ("chosen_partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_professional_id_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_profiles_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_professional_start_idx" ON "bookings" USING btree ("professional_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_org_start_idx" ON "bookings" USING btree ("org_id","start_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_queue_status_idx" ON "moderation_queue" USING btree ("status","created_at");--> statement-breakpoint
CREATE POLICY "org_ledger_select" ON "org_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator') or "org_ledger"."org_id" = auth_org_id());--> statement-breakpoint
CREATE POLICY "org_wallets_select" ON "org_wallets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() = 'admin' or "org_wallets"."org_id" = auth_org_id());--> statement-breakpoint
CREATE POLICY "orgs_select" ON "orgs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() = 'admin' or "orgs"."id" = auth_org_id());--> statement-breakpoint
CREATE POLICY "profiles_select" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        auth_role() = 'admin'
        or "profiles"."id" = auth.uid()
        or ("profiles"."org_id" is not null and "profiles"."org_id" = auth_org_id())
        or exists (
          select 1 from partners p
           where p.id = profiles.id and p.status = 'active'
        ));--> statement-breakpoint
CREATE POLICY "profiles_update_self" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = auth.uid()) WITH CHECK ("profiles"."id" = auth.uid());--> statement-breakpoint
CREATE POLICY "wallet_ledger_select_self" ON "wallet_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("wallet_ledger"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "wallets_select_self" ON "wallets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("wallets"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "partner_applications_select_staff" ON "partner_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "partner_exceptions_select" ON "partner_exceptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        auth_role() in ('admin','moderator')
        or "partner_exceptions"."partner_id" = auth.uid()
        or exists (
          select 1 from partners p
           where p.id = partner_exceptions.partner_id and p.status = 'active'
        ));--> statement-breakpoint
CREATE POLICY "partner_exceptions_write_self" ON "partner_exceptions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("partner_exceptions"."partner_id" = auth.uid()) WITH CHECK ("partner_exceptions"."partner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "partner_invites_select_staff" ON "partner_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "partner_rules_select" ON "partner_rules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        auth_role() in ('admin','moderator')
        or "partner_rules"."partner_id" = auth.uid()
        or exists (
          select 1 from partners p
           where p.id = partner_rules.partner_id and p.status = 'active'
        ));--> statement-breakpoint
CREATE POLICY "partner_rules_write_self" ON "partner_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("partner_rules"."partner_id" = auth.uid()) WITH CHECK ("partner_rules"."partner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "partners_select" ON "partners" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("partners"."status" = 'active' or "partners"."id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "partners_update_self" ON "partners" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("partners"."id" = auth.uid()) WITH CHECK ("partners"."id" = auth.uid());--> statement-breakpoint
CREATE POLICY "bookings_select_participants" ON "bookings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bookings"."professional_id" = auth.uid() or "bookings"."partner_id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "briefings_select_participants" ON "briefings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        exists (
          select 1 from bookings b
           where b.id = briefings.booking_id
             and (b.professional_id = auth.uid() or b.partner_id = auth.uid())
        ));--> statement-breakpoint
CREATE POLICY "briefings_write_own" ON "briefings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("briefings"."professional_id" = auth.uid()) WITH CHECK ("briefings"."professional_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "reviews_select_participants" ON "reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("reviews"."professional_id" = auth.uid() or "reviews"."partner_id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "reviews_insert_own" ON "reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("reviews"."professional_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "session_events_select_participants" ON "session_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        auth_role() in ('admin','moderator')
        or exists (
          select 1 from bookings b
           where b.id = session_events.booking_id
             and (b.professional_id = auth.uid() or b.partner_id = auth.uid())
        ));--> statement-breakpoint
CREATE POLICY "async_questions_select_participants" ON "async_questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("async_questions"."professional_id" = auth.uid() or "async_questions"."partner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "checkins_own" ON "checkins" AS PERMISSIVE FOR ALL TO "authenticated" USING ("checkins"."professional_id" = auth.uid()) WITH CHECK ("checkins"."professional_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "gift_quotas_select_self" ON "gift_quotas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("gift_quotas"."partner_id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "goals_own" ON "goals" AS PERMISSIVE FOR ALL TO "authenticated" USING ("goals"."professional_id" = auth.uid()) WITH CHECK ("goals"."professional_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "notifications_select_self" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notifications"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "notifications_update_self" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notifications"."user_id" = auth.uid()) WITH CHECK ("notifications"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "partner_hours_select_self" ON "partner_hours" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("partner_hours"."partner_id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "suggestion_events_select_staff" ON "suggestion_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "waitlist_select_participants" ON "waitlist" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("waitlist"."professional_id" = auth.uid() or "waitlist"."partner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "waitlist_write_own" ON "waitlist" AS PERMISSIVE FOR ALL TO "authenticated" USING ("waitlist"."professional_id" = auth.uid()) WITH CHECK ("waitlist"."professional_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "app_config_select_all" ON "app_config" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "audit_logs_select_staff" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "moderation_queue_select_staff" ON "moderation_queue" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "reports_select" ON "reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("reports"."reporter_id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "reports_insert_own" ON "reports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("reports"."reporter_id" = auth.uid());