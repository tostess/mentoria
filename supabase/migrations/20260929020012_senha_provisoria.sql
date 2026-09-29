-- ---------------------------------------------------------------------------
-- Senha provisória — toda conta que já existe é convidada a trocar a senha
-- ---------------------------------------------------------------------------
-- A partir desta migração, conta criada pelo admin nasce com
-- `app_metadata.senha_provisoria = true`, e a senha nova gerada pelo admin
-- volta a marcar. As contas anteriores receberam senha do mesmo jeito — ditada
-- ou colada num WhatsApp — e não têm marca nenhuma; esta migração as iguala.
--
-- A marca mora em `auth.users` e não em `profiles`: chega ao JWT sem consulta,
-- só o `service_role` a escreve, e colega de empresa não lê quem ainda está com
-- a senha que chegou por mensagem. Quem a tira é a própria pessoa, trocando a
-- senha pela tela (`trocarSenha`).
--
-- Só dado, sem esquema. Rodar de novo remarcaria quem já trocou; quem garante
-- que roda uma vez por banco é o journal do drizzle.
UPDATE auth.users
   SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || '{"senha_provisoria": true}'::jsonb
 WHERE deleted_at IS NULL;
