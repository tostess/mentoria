# supabase/

`migrations/` guarda a DDL versionada. Cada arquivo é gerado por
`npm run db:generate` a partir de `src/lib/db/schema.ts` e aplicado com
`npm run db:migrate`.

Duas regras:

- **Nunca alterar esquema pelo painel do Supabase.** O painel não deixa rastro
  e o próximo `db:generate` desfaz a mudança.
- **Nunca `drizzle-kit push`.** Ele sincroniza sem gerar arquivo — por isso o
  script não existe no `package.json`.

Triggers, policies de RLS e as constraints que sustentam as invariantes 3, 6 e
7 não saem do schema do Drizzle: entram como SQL escrito à mão dentro do
arquivo de migração gerado. Está vazio até a Etapa 3.
