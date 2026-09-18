-- Vocabulário e marca saem do banco.
--
-- O contrato diz que nenhum termo de domínio é hardcoded e que todos vivem em
-- `app_config.copy.terms`. Até aqui viviam num objeto TypeScript, o que dava
-- no mesmo que hardcoded — a empresa que chamasse Parceiro de outra coisa
-- exigiria deploy. Estas duas chaves fecham o caminho.
--
-- `copy` nasce com o vocabulário **default**, escrito por extenso em vez de
-- vazio, para que a personalização por empresa (F4) seja uma edição do que já
-- está lá, e não um exercício de adivinhar os nomes das chaves.
INSERT INTO "app_config" ("key", "value") VALUES
  ('copy', '{
     "terms": {
       "partner": "Parceiro",
       "partnerLong": "Parceiro de Desenvolvimento",
       "partners": "Parceiros",
       "professional": "Profissional",
       "professionals": "Profissionais",
       "ficha": "ficha",
       "fichas": "fichas",
       "org": "Empresa",
       "orgs": "Empresas",
       "orgAdmin": "RH",
       "admin": "Operadora",
       "moderator": "Moderação",
       "session": "sessão",
       "sessions": "sessões"
     },
     "legal": {
       "terms_url": null,
       "privacy_url": null
     }
   }'::jsonb),
  -- Nome, accent e logotipo da plataforma. `name` fica nulo de propósito: o
  -- nome ainda está em aberto, e nulo cai no placeholder do tema em vez de
  -- gravar no banco um nome que ninguém decidiu.
  ('branding', '{
     "name": null,
     "accent": "#C2317A",
     "logo_url": null
   }'::jsonb)
ON CONFLICT ("key") DO NOTHING;
