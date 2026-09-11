-- Epílogo: as invariantes que o Drizzle não modela.
--
-- Tudo aqui é garantia de banco, não de código. A diferença importa: código
-- esquecido falha em silêncio, constraint esquecida derruba a transação.

-- ---------------------------------------------------------------------------
-- Invariante 7 — sobreposição é impedida pelo banco
-- ---------------------------------------------------------------------------
-- Um Parceiro não pode ter duas sessões que se cruzem no tempo. O `where`
-- restringe aos status ativos: sessão cancelada ou expirada libera o horário.
-- Cobre a extensão de 30 para 60 minutos sem nenhum código extra, porque quem
-- estende move `end_at` e o range acompanha.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "partner_id" WITH =,
    tstzrange("start_at", "end_at") WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Invariante 3 — saldo é derivado do livro-caixa
-- ---------------------------------------------------------------------------
-- O saldo não é escrito por quem insere o lançamento: é o trigger que soma.
-- `check (balance >= 0)` em `wallets` derruba a transação inteira no débito
-- indevido, então não existe caminho de código que produza saldo negativo.
CREATE OR REPLACE FUNCTION public.apply_wallet_entry() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  UPDATE public.wallets
     SET balance = balance + new.amount,
         last_entry_at = now(),
         last_used_at = CASE WHEN new.amount < 0 THEN now() ELSE last_used_at END
   WHERE user_id = new.user_id
  RETURNING balance INTO new.balance_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'carteira inexistente: %', new.user_id;
  END IF;

  RETURN new;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.apply_org_entry() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  UPDATE public.org_wallets
     SET balance = balance + new.amount,
         last_entry_at = now()
   WHERE org_id = new.org_id
  RETURNING balance INTO new.balance_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'carteira de empresa inexistente: %', new.org_id;
  END IF;

  RETURN new;
END $$;
--> statement-breakpoint

-- Livro-caixa é imutável. Correção é lançamento novo do tipo `adjust`, nunca
-- edição — é isso que faz o histórico valer como prova.
CREATE OR REPLACE FUNCTION public.block_mutation() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'livro-caixa é imutável: use um lançamento adjust';
END $$;
--> statement-breakpoint

CREATE TRIGGER trg_wallet_entry BEFORE INSERT ON "wallet_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_entry();
--> statement-breakpoint
CREATE TRIGGER trg_wallet_ledger_immutable BEFORE UPDATE OR DELETE ON "wallet_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_org_entry BEFORE INSERT ON "org_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.apply_org_entry();
--> statement-breakpoint
CREATE TRIGGER trg_org_ledger_immutable BEFORE UPDATE OR DELETE ON "org_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Privilégio de coluna — o que a policy não alcança
-- ---------------------------------------------------------------------------
-- RLS decide QUAIS LINHAS, nunca QUAIS COLUNAS. Sem isto, a policy
-- `partners_update_self` deixaria o Parceiro escrever o próprio `status` e
-- virar `active` sozinho, furando a invariante 8.
REVOKE UPDATE ON "partners" FROM authenticated;
--> statement-breakpoint
GRANT UPDATE ("headline", "bio", "areas", "skills", "seniority",
              "buffer_min", "max_per_week", "auto_confirm")
  ON "partners" TO authenticated;
--> statement-breakpoint

-- Invariante 19 do outro lado: o papel vem do JWT, mas quem escrevesse
-- `profiles.role` mudaria o que o JWT passa a carregar no próximo login.
REVOKE UPDATE ON "profiles" FROM authenticated;
--> statement-breakpoint
GRANT UPDATE ("name", "photo_url", "timezone", "job_title", "area",
              "phone", "notif_prefs")
  ON "profiles" TO authenticated;
--> statement-breakpoint

-- Invariante 4: o cliente nunca escreve nestas cinco. Não há policy de
-- escrita, e agora também não há privilégio — cinto e suspensório, porque uma
-- policy adicionada por engano no futuro não basta para abrir a porta.
REVOKE INSERT, UPDATE, DELETE ON "bookings"      FROM authenticated, anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "wallets"       FROM authenticated, anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "wallet_ledger" FROM authenticated, anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "org_wallets"   FROM authenticated, anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "org_ledger"    FROM authenticated, anon;
--> statement-breakpoint

-- Invariante 12: audit_logs é escrito só pelo servidor e nunca alterado.
REVOKE INSERT, UPDATE, DELETE ON "audit_logs" FROM authenticated, anon;
--> statement-breakpoint
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Invariante 10 — o único recorte que o RH enxerga
-- ---------------------------------------------------------------------------
-- `org_usage` é view, não tabela: a taxa de utilização é uma query sobre o
-- livro-caixa, não um cron de pré-agregação. Materializar só se ficar lenta.
--
-- A view roda como dona (não `security_invoker`), então ignora a RLS de
-- `wallet_ledger` — que só deixa cada um ver a própria carteira. É isso que
-- permite ao RH ver o agregado sem nunca ver a linha individual. O recorte
-- por empresa vive DENTRO da view, no `where`.
CREATE OR REPLACE FUNCTION public.can_read_org(target uuid) RETURNS boolean
  LANGUAGE sql STABLE
  SET search_path = ''
AS $$
  SELECT
    -- Conexão direta do servidor (Drizzle): não existe contexto de JWT.
    nullif(current_setting('request.jwt.claims', true), '') IS NULL
    -- Cliente `service_role` via PostgREST: tem claims, mas não tem user_role.
    OR current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
    OR public.auth_role() = 'admin'
    OR target = public.auth_org_id()
$$;
--> statement-breakpoint

CREATE OR REPLACE VIEW public.org_usage AS
  SELECT
    wl.org_id,
    date_trunc('month', wl.created_at)::date                              AS month,
    coalesce(sum(wl.amount) FILTER (WHERE wl.type = 'allocate'), 0)::int  AS fichas_allocated,
    coalesce(-sum(wl.amount) FILTER (WHERE wl.type = 'spend'), 0)::int    AS fichas_spent,
    coalesce(sum(wl.amount) FILTER (WHERE wl.type = 'refund'), 0)::int    AS fichas_refunded,
    count(DISTINCT wl.user_id) FILTER (WHERE wl.type = 'spend')::int      AS active_professionals
  FROM public.wallet_ledger wl
  WHERE public.can_read_org(wl.org_id)
  GROUP BY wl.org_id, date_trunc('month', wl.created_at);
--> statement-breakpoint

REVOKE ALL ON public.org_usage FROM anon;
--> statement-breakpoint
GRANT SELECT ON public.org_usage TO authenticated, service_role;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Configuração inicial
-- ---------------------------------------------------------------------------
-- A política da ficha nasce no banco, não hardcoded. `app_config` é legível
-- por qualquer autenticado e escrita só por `service_role`.
INSERT INTO "app_config" ("key", "value") VALUES
  ('ficha_policy', '{
     "default_allocation_per_user": 2,
     "expires": false,
     "max_balance": 6,
     "price_30": 1,
     "cancel_window_hours": 12,
     "partner_no_show_bonus": 1,
     "gift_quota_monthly": 3,
     "extension_quota_monthly": 3,
     "idle_nudge_after_days": 21
   }'::jsonb),
  ('limits', '{
     "booking_horizon_days": 14,
     "max_pending_per_professional": 2,
     "pending_expires_hours": 48,
     "min_notice_hours": 12,
     "session_grace_minutes": 15
   }'::jsonb),
  ('flags', '{"partner_earns_fichas": false}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
