-- ---------------------------------------------------------------------------
-- P4 — o Parceiro lê o perfil de quem marcou sessão com ele
-- ---------------------------------------------------------------------------
-- Até aqui a policy de `profiles` não deixava o Parceiro ler perfil de
-- Profissional nenhum: ele não tem `org_id`, e o recorte por empresa nunca
-- casava. A tela de sessões do Parceiro mostraria pedidos sem nome.
--
-- É view, e não policy nova em `profiles` e `orgs`, pelo que a policy abriria
-- junto: RLS decide linha, não coluna. Uma policy em `profiles` entregaria
-- e-mail, telefone e preferências de notificação — contato fora da plataforma
-- que a sessão não pede —, e uma em `orgs` entregaria CNPJ, tamanho do contrato
-- e marca de uma empresa a alguém que atende as concorrentes dela.
--
-- Mesmo desenho de `org_usage`: roda como dona, ignorando a RLS das tabelas de
-- baixo, e o recorte vive **dentro** do `where`. Só aparece quem tem sessão com
-- o Parceiro que pergunta, em qualquer status — o histórico também precisa do
-- nome. Invariante 10 continua de pé: o filtro exige papel de Parceiro, então o
-- RH não lê daqui par nenhum.
CREATE OR REPLACE VIEW public.partner_professionals AS
  SELECT
    p.id,
    p.name,
    p.photo_url,
    p.job_title,
    p.area,
    o.name AS org_name
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

REVOKE ALL ON public.partner_professionals FROM anon;
--> statement-breakpoint
GRANT SELECT ON public.partner_professionals TO authenticated, service_role;
