CREATE TYPE "public"."org_kind" AS ENUM('empresa', 'individual');--> statement-breakpoint
ALTER TYPE "public"."ledger_type" ADD VALUE 'expire';--> statement-breakpoint
CREATE TABLE "ficha_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"fichas" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ficha_lots_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "ficha_lots_id_user_uq" UNIQUE("id","user_id"),
	CONSTRAINT "ficha_lots_fichas_pos" CHECK ("ficha_lots"."fichas" > 0)
);
--> statement-breakpoint
ALTER TABLE "ficha_lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "individual_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"job_title" text,
	"area" text,
	"linkedin" text,
	"goal" text,
	"terms_version" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "individual_signups_status" CHECK ("individual_signups"."status" in ('pending','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "individual_signups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"package_id" text NOT NULL,
	"fichas" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"provider_customer_id" text,
	"method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"invoice_url" text,
	"reference" text,
	"created_by" uuid,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "payments_fichas_pos" CHECK ("payments"."fichas" > 0),
	CONSTRAINT "payments_amount_nonneg" CHECK ("payments"."amount_cents" >= 0),
	CONSTRAINT "payments_provider" CHECK ("payments"."provider" in ('asaas','manual')),
	CONSTRAINT "payments_status" CHECK ("payments"."status" in ('pending','confirmed','refunded','failed','expired'))
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "kind" "org_kind" DEFAULT 'empresa' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "ficha_lots" ADD CONSTRAINT "ficha_lots_user_id_wallets_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wallets"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_lots" ADD CONSTRAINT "ficha_lots_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_lots" ADD CONSTRAINT "ficha_lots_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_signups" ADD CONSTRAINT "individual_signups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ficha_lots_user_idx" ON "ficha_lots" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "individual_signups_email_pending_uq" ON "individual_signups" USING btree (lower("email")) WHERE "individual_signups"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "individual_signups_status_idx" ON "individual_signups" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_lot_fk" FOREIGN KEY ("lot_id","user_id") REFERENCES "public"."ficha_lots"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_cpf_individual_uq" ON "orgs" USING btree ("cpf") WHERE "orgs"."kind" = 'individual';--> statement-breakpoint
CREATE INDEX "wallet_ledger_lot_idx" ON "wallet_ledger" USING btree ("lot_id");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_cnpj_so_empresa" CHECK ("orgs"."kind" = 'empresa' or "orgs"."cnpj" is null);--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_cpf_so_individual" CHECK ("orgs"."kind" = 'individual' or "orgs"."cpf" is null);--> statement-breakpoint
CREATE POLICY "ficha_lots_select" ON "ficha_lots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ficha_lots"."user_id" = auth.uid() or auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "individual_signups_select_staff" ON "individual_signups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth_role() in ('admin','moderator'));--> statement-breakpoint
CREATE POLICY "payments_select" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("payments"."user_id" = auth.uid() or auth_role() in ('admin','moderator'));
--> statement-breakpoint

-- ===========================================================================
-- A1 — conta individual (Profissional avulso, diretriz de 01/10/2026)
-- ===========================================================================
-- Daqui para baixo, o que o Drizzle não modela. A conta pessoal é uma `org` de
-- um só (`kind = 'individual'`): RLS, carteira, reserva e fechamento valem para
-- ela sem caso especial. O que muda é o que está abaixo.

-- ---------------------------------------------------------------------------
-- Invariante 4 estendida — o cliente nunca escreve nas três tabelas novas
-- ---------------------------------------------------------------------------
-- Sem policy de escrita, e agora também sem privilégio: o pedido de cadastro,
-- o pagamento e o lote são gravados pelo servidor.
REVOKE INSERT, UPDATE, DELETE ON "individual_signups" FROM authenticated, anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "payments"           FROM authenticated, anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "ficha_lots"         FROM authenticated, anon;
--> statement-breakpoint

-- O lote é parte do livro-caixa: nasce com o crédito e não muda. O restante
-- dele é derivado de `wallet_ledger.lot_id`, então não há o que atualizar.
CREATE TRIGGER trg_ficha_lots_immutable BEFORE UPDATE OR DELETE ON "ficha_lots"
  FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- A conta pessoal tem um dono só, e ele é Profissional
-- ---------------------------------------------------------------------------
-- Sem isto, um segundo perfil na mesma `org` individual veria o primeiro pela
-- policy de `profiles` (mesma empresa), e um `org_admin` nela seria um "RH" de
-- uma pessoa. A função trava a linha da `org` antes de contar, para dois
-- inserts simultâneos não passarem os dois.
CREATE OR REPLACE FUNCTION public.check_individual_org_member() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  tipo public.org_kind;
BEGIN
  IF new.org_id IS NULL THEN
    RETURN new;
  END IF;

  SELECT kind INTO tipo FROM public.orgs WHERE id = new.org_id FOR UPDATE;

  IF tipo = 'individual' THEN
    IF new.role <> 'professional' THEN
      RAISE EXCEPTION 'conta pessoal só tem Profissional: %', new.org_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles
                WHERE org_id = new.org_id AND id <> new.id) THEN
      RAISE EXCEPTION 'conta pessoal já tem dono: %', new.org_id;
    END IF;
  END IF;

  RETURN new;
END $$;
--> statement-breakpoint

CREATE TRIGGER trg_profiles_individual_org BEFORE INSERT OR UPDATE OF org_id, role ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION public.check_individual_org_member();
--> statement-breakpoint

-- O tipo é decidido na criação. Trocar depois transformaria uma empresa com
-- colaboradores em "conta pessoal" (ou o contrário) sem passar pela regra acima.
CREATE OR REPLACE FUNCTION public.block_org_kind_change() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF new.kind IS DISTINCT FROM old.kind THEN
    RAISE EXCEPTION 'o tipo da conta não muda: %', old.id;
  END IF;
  RETURN new;
END $$;
--> statement-breakpoint

CREATE TRIGGER trg_orgs_kind_immutable BEFORE UPDATE OF kind ON "orgs"
  FOR EACH ROW EXECUTE FUNCTION public.block_org_kind_change();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Taxa de utilização: só empresas
-- ---------------------------------------------------------------------------
-- A utilização é o indicador de renovação de contrato. Conta pessoal não tem
-- contrato para renovar, e as fichas compradas dela puxariam a média das
-- empresas sem dizer nada sobre nenhuma. Mesmas colunas, na mesma ordem.
CREATE OR REPLACE VIEW public.org_usage AS
  SELECT
    wl.org_id,
    date_trunc('month', wl.created_at)::date                              AS month,
    coalesce(sum(wl.amount) FILTER (WHERE wl.type = 'allocate'), 0)::int  AS fichas_allocated,
    coalesce(-sum(wl.amount) FILTER (WHERE wl.type = 'spend'), 0)::int    AS fichas_spent,
    coalesce(sum(wl.amount) FILTER (WHERE wl.type = 'refund'), 0)::int    AS fichas_refunded,
    count(DISTINCT wl.user_id) FILTER (WHERE wl.type = 'spend')::int      AS active_professionals,
    coalesce(sum(wl.amount) FILTER (WHERE wl.type = 'gift'
                                       OR (wl.type = 'adjust' AND wl.amount > 0)), 0)::int
                                                                          AS fichas_extra,
    coalesce(-sum(wl.amount) FILTER (WHERE wl.type IN ('spend', 'refund')), 0)::int
                                                                          AS fichas_used
  FROM public.wallet_ledger wl
  JOIN public.orgs o ON o.id = wl.org_id AND o.kind = 'empresa'
  WHERE public.can_read_org(wl.org_id)
  GROUP BY wl.org_id, date_trunc('month', wl.created_at);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- O Parceiro não vê "empresa" de quem é avulso
-- ---------------------------------------------------------------------------
-- O nome da `org` individual é o nome da própria pessoa: mostrá-lo como
-- empresa repetiria o nome e insinuaria um vínculo que não existe.
CREATE OR REPLACE VIEW public.partner_professionals AS
  SELECT
    p.id,
    p.name,
    p.photo_url,
    p.job_title,
    p.area,
    CASE WHEN o.kind = 'empresa' THEN o.name END AS org_name
  FROM public.profiles p
  JOIN public.orgs o ON o.id = p.org_id
  WHERE p.role = 'professional'
    AND public.auth_role() = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.bookings b
       WHERE b.professional_id = p.id
         AND b.partner_id = auth.uid()
    );
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Invariante 19: o tipo da conta também vem do JWT
-- ---------------------------------------------------------------------------
-- A tela do Profissional muda de texto conforme a conta ("o RH da sua empresa
-- distribui" não vale para quem compra as próprias fichas), e a casca renderiza
-- em paralelo com a página — consultar `orgs` ali seria a leitura que entala a
-- conexão. Então `org_kind` vai no token, ao lado de `org_id`, escrito pelo
-- mesmo hook. Mesma liberação de leitura que `profiles` recebeu na Etapa 4.
GRANT SELECT ON public.orgs TO supabase_auth_admin;
--> statement-breakpoint
CREATE POLICY "orgs_auth_admin_read" ON public.orgs
  FOR SELECT TO supabase_auth_admin
  USING (true);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  profile record;
BEGIN
  SELECT p.role::text AS role, p.org_id, o.kind::text AS org_kind
    INTO profile
    FROM public.profiles p
    LEFT JOIN public.orgs o ON o.id = p.org_id
   WHERE p.id = (event ->> 'user_id')::uuid
     AND p.active
     AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN event;
  END IF;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(profile.role));

  IF profile.org_id IS NULL THEN
    claims := claims - 'org_id' - 'org_kind';
  ELSE
    claims := jsonb_set(claims, '{org_id}', to_jsonb(profile.org_id::text));
    claims := jsonb_set(claims, '{org_kind}', to_jsonb(profile.org_kind));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END $$;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Pacotes e política da conta pessoal
-- ---------------------------------------------------------------------------
-- Editáveis sem deploy, como a política da ficha. O pagamento congela o preço
-- do momento em `payments.amount_cents`; mudar a tabela não mexe em compra feita.
INSERT INTO "app_config" ("key", "value") VALUES
  ('individual_packages', '{
     "pacotes": [
       {"id": "primeira-conversa", "nome": "Primeira conversa", "fichas": 1,
        "preco_centavos": 12900, "parcelas_max": 1, "ativo": true},
       {"id": "ritmo", "nome": "Ritmo", "fichas": 4,
        "preco_centavos": 44900, "parcelas_max": 2, "ativo": true},
       {"id": "jornada", "nome": "Jornada", "fichas": 8,
        "preco_centavos": 79900, "parcelas_max": 3, "ativo": true}
     ]
   }'::jsonb),
  ('individual_policy', '{
     "validade_meses": 12,
     "arrependimento_dias": 7
   }'::jsonb)
ON CONFLICT ("key") DO NOTHING;
