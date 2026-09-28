-- ---------------------------------------------------------------------------
-- P5 — a sessão não se estende (decisão de 27/09/2026)
-- ---------------------------------------------------------------------------
-- O spike mostrou que o Daily fixa a hora de expulsão na entrada de cada
-- pessoa; estender exigiria cron de minuto em minuto ou derrubar as duas telas.
-- A extensão saiu do produto e sai do esquema junto: coluna morta com nome de
-- regra viva é convite para alguém reimplementá-la sem saber por que caiu.
ALTER TABLE "gift_quotas" DROP CONSTRAINT "gift_quotas_extensions_nonneg";--> statement-breakpoint
ALTER TABLE "partners" DROP COLUMN "extension_quota_monthly";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "extended_by";--> statement-breakpoint
ALTER TABLE "gift_quotas" DROP COLUMN "extensions_used";--> statement-breakpoint

UPDATE "app_config" SET "value" = "value" - 'extension_quota_monthly' WHERE "key" = 'ficha_policy';--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Taxa de utilização: usada é líquida de estorno; recebida inclui o que não
-- saiu do contrato
-- ---------------------------------------------------------------------------
-- Duas correções no indicador que sustenta a renovação.
--
-- 1. Desde a P4 existe estorno (recusa e expiração), e `fichas_spent` conta o
--    gasto bruto: pedido recusado entrava como ficha usada. `fichas_used` é
--    gasto menos estorno. Por mês pode sair negativo — gasto em setembro,
--    estorno em outubro —, e somado no período fecha certo.
-- 2. O presente do Parceiro (`gift`) e a compensação por falta dele (`adjust`
--    positivo) chegam à carteira sem sair do contrato. Gastos, entram no
--    numerador; sem `fichas_extra` no denominador a taxa passaria de 100%.
--
-- As colunas antigas ficam, na mesma ordem: `CREATE OR REPLACE VIEW` só aceita
-- coluna nova no fim, e é isso que mantém os grants e quem já lê a view.
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
  WHERE public.can_read_org(wl.org_id)
  GROUP BY wl.org_id, date_trunc('month', wl.created_at);
