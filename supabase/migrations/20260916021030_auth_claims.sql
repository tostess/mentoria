-- Invariante 19 ligada: o papel e a empresa entram no JWT.
--
-- Toda a RLS da Etapa 3 chama `auth_role()` e `auth_org_id()`, que leem
-- `request.jwt.claims ->> 'user_role'` e `->> 'org_id'`. Sem este hook essas
-- claims nunca existem: quem loga é `authenticated` sem papel, e toda policy
-- nega. O esquema estava montado, mas desligado.
--
-- Quem chama é o servidor de auth do Supabase (GoTrue), ao emitir o token —
-- não a aplicação. A função recebe o `event` e devolve o mesmo objeto com
-- `claims` enriquecido. Ligar o gancho é passo de painel
-- (Authentication → Hooks → Customize Access Token), registrado no STATUS.

-- O hook roda como `supabase_auth_admin`, um papel que não é dono do esquema
-- `public` e não tinha nenhum acesso a ele.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
--> statement-breakpoint
GRANT SELECT ON public.profiles TO supabase_auth_admin;
--> statement-breakpoint

-- Privilégio abre a tabela; RLS ainda fecha a linha. `supabase_auth_admin` não
-- é `bypassrls`, então sem policy própria o hook leria zero linhas e todo mundo
-- receberia token sem papel — a falha mais silenciosa possível.
CREATE POLICY "profiles_auth_admin_read" ON public.profiles
  FOR SELECT TO supabase_auth_admin
  USING (true);
--> statement-breakpoint

-- `security definer` porque quem chama não é dono da tabela; `search_path = ''`
-- porque função definer com search_path mutável é caminho de escalonamento —
-- daí todo nome vir qualificado.
--
-- Três decisões dentro do corpo:
--
-- 1. `org_id` só é escrito quando existe. Parceiro, admin e moderador são da
--    plataforma (invariante 9) e recebem token **sem** a claim, não com ela
--    vazia: `auth_org_id()` devolve null nos dois casos, mas claim ausente é
--    mais honesta do que claim nula e evita um cast de string vazia.
--
-- 2. Pessoa inativa ou excluída não recebe `user_role`. É o desligamento de
--    acesso mais barato que existe: sem a claim, toda policy da Etapa 3 nega
--    sozinha, sem nenhuma linha de código na aplicação.
--
-- 3. Perfil inexistente devolve o `event` intacto. Usuário criado em
--    `auth.users` antes da linha em `profiles` consegue token, mas não enxerga
--    nada — em vez de derrubar o login com exceção.
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
  SELECT p.role::text AS role, p.org_id
    INTO profile
    FROM public.profiles p
   WHERE p.id = (event ->> 'user_id')::uuid
     AND p.active
     AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN event;
  END IF;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(profile.role));

  IF profile.org_id IS NULL THEN
    claims := claims - 'org_id';
  ELSE
    claims := jsonb_set(claims, '{org_id}', to_jsonb(profile.org_id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END $$;
--> statement-breakpoint

-- Só o servidor de auth executa. Se `authenticated` pudesse chamar, qualquer
-- pessoa logada montaria um `event` com o `user_id` alheio e leria o papel e a
-- empresa de quem quisesse — a função é `security definer`.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
