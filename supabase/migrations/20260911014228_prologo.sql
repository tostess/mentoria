-- Prólogo: o que precisa existir ANTES das tabelas e das policies.
--
-- A migração base cria os enums e, no mesmo arquivo, as policies que chamam
-- `auth_role()`. O Postgres resolve a função no `create policy`, então ela tem
-- de vir antes — e não pode devolver `user_role`, que ainda não existe.
-- Por isso devolve `text`. A comparação nas policies é idêntica
-- (`auth_role() = 'admin'`); o que se perde é o erro de digitação pego pelo
-- tipo, e o que se ganha é não ter enum duplicado entre duas migrações.

-- Invariante 7: a constraint de exclusão de `bookings` combina igualdade
-- (`partner_id`) com sobreposição (`tstzrange`) no mesmo índice GiST. Só o
-- btree_gist sabe indexar `=` dentro de um GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Invariante 19: papel e `org_id` são lidos do JWT, nunca de campo de tabela.
-- Se viessem da tabela, quem conseguisse escrever em `profiles` escalaria o
-- próprio papel. `stable` deixa o Postgres avaliar uma vez por statement, o
-- que torna desprezível o custo de chamá-las dentro de toda policy.
--
-- `search_path = ''` porque a função não toca em tabela nenhuma: sem isso o
-- linter do Supabase acusa search_path mutável, que é caminho de escalonamento
-- em função `security definer`.
CREATE OR REPLACE FUNCTION public.auth_role() RETURNS text
  LANGUAGE sql STABLE
  SET search_path = ''
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', '')
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.auth_org_id() RETURNS uuid
  LANGUAGE sql STABLE
  SET search_path = ''
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated, anon, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated, anon, service_role;
