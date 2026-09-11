# STATUS

Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit final.

| Data | Etapa | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-10 | 3 | Esquema em `src/lib/db/schema/` (7 módulos, 27 tabelas); três migrações versionadas — prólogo, base gerada, epílogo; RLS nas 27 com 36 policies; `bookings_no_overlap`; triggers de saldo e imutabilidade; privilégio de coluna em `partners.status` e `profiles.role`; view `org_usage`; `app_config` semeada; 20 testes de invariante contra o Postgres, incluindo RLS exercitada como usuário logado | `org_admin` ainda não tem caminho de leitura além de `org_usage` — confirmar na Etapa 4 | `1e8b744` |
| 2026-09-10 | 2 | `.env.local.example`; `env.ts` público e `env.server.ts` com `server-only`; clientes `supabase/client`, `server` e `admin`; Drizzle sobre postgres.js com pool cacheado; `drizzle.config.ts` gerando em `supabase/migrations/` com prefixo `supabase`; `vercel.json` em `gru1`; `GET /api/health`; `npm run check:supabase`; teste estático da invariante 5 | — conexão verificada ponta a ponta contra `mentoria-dev` | `7b308da` |
| 2026-09-10 | 1 | Fontes via `next/font`; 11 componentes em `components/ui`; `theme.ts` com `resolveTheme`; `terms.ts`; shell com sidebar 246px e bloco de topo por papel; grupos `(auth)`, `(professional)`, `(partner)`, `(org)`, `(admin)` com 17 páginas vazias; `/design` só em dev com seletor de accent | Nome da plataforma é placeholder ("Mentoria") até `app_config` | `761d11d` |
| 2026-09-10 | 0 | Contrato migrado para Supabase; artefatos de Firebase removidos; `npm run build` verde | — | `27ff6d7` |

## Bloqueios abertos

- **Projeto `mentoria` (produção) ainda não criado.** Invariante 17. Não bloqueia o piloto local.
- **Variáveis ainda não cadastradas na Vercel.** Só existem em `.env.local`.

## Decisões de sessão
_(dependência escolhida, atalho tomado, dívida assumida — o que não merece o CLAUDE.md)_

- **2026-09-10 (Etapa 3):** três migrações em vez de uma, por ordem de dependência. As policies
  chamam `auth_role()` e o Postgres resolve a função no `create policy`, então ela tem de existir
  antes do arquivo que cria as tabelas. O prólogo foi criado com `drizzle-kit generate --custom`
  **antes** do `generate` normal, para o journal ficar consistente — o snapshot do custom nasce
  vazio, então a base sai completa depois dele.
- **2026-09-10 (Etapa 3):** `profiles` ganhou uma policy a mais do que o `CLAUDE.md` previa: o
  perfil de qualquer Parceiro **ativo** é legível por qualquer autenticado. Sem ela a busca da P4
  devolveria Parceiros sem nome, porque `partners` é visível a todas as empresas (invariante 9) mas
  o nome mora em `profiles`. É a leitura mínima que faz a invariante 9 funcionar de ponta a ponta.
- **2026-09-10 (Etapa 3):** `wallets.last_used_at` passou a ser preenchido pelo mesmo trigger do
  saldo, quando o lançamento é negativo. É o que alimenta o `nudge-idle` sem job extra.
- **2026-09-10 (Etapa 3):** `gift_quotas` tem `period` (`YYYYMM`) na chave primária em vez de um job
  de reset mensal — quota que não acumula é quota cujo mês novo simplesmente não tem linha ainda.
- **2026-09-10 (Etapa 3):** `moderation_queue.ref_id` é polimórfico (aponta para a tabela indicada
  por `kind`), sem FK. Dívida assumida: o banco não garante a integridade desse ponteiro. A
  alternativa era uma coluna por tipo, que cresce a cada tipo novo.
- **2026-09-10 (Etapa 3):** os testes de invariante rodam em transação com rollback forçado e se
  **pulam sozinhos** sem `DIRECT_URL`, para a suíte não quebrar em CI sem credencial. Verificado por
  mutação: com sessões que não se cruzam, o teste de sobreposição falha em vez de passar à toa.
- **2026-09-10 (Etapa 3):** a invariante 10 é testada por **comportamento**, não por catálogo:
  `set local role authenticated` mais `request.jwt.claims` reproduzem o contexto que o PostgREST
  monta, e o RH consulta de verdade. Os testes se validam entre si — se a troca de papel falhasse,
  o RH enxergaria a sessão. Confirmado por mutação: com as claims do Profissional dono, a mesma
  query devolve 1 em vez de 0. A primeira versão do teste era vazia (checava briefing e livro-caixa
  em tabelas sem linha); agora o cenário insere os dois antes de conferir que o RH não os vê.

- **2026-09-10 (Etapa 2, fechamento):** `npm run check:supabase` todo verde e `GET /api/health`
  em `next start` respondendo `200` com `ok: true` (banco 17ms pelo pooler de transação). Os três
  valores tinham ido para campos trocados: a senha do banco no `SUPABASE_SECRET_KEY`, a Project URL
  no `DATABASE_URL`, e a senha entre colchetes no `DIRECT_URL`.
- **2026-09-10 (Etapa 2):** conexão confirmada contra `mentoria-dev`: Postgres 17.6, `public`
  vazio, `drizzle.__drizzle_migrations` criada por um `db:migrate` sem migração nenhuma. O pooler é
  `aws-0-sa-east-1.pooler.supabase.com` (usuário `postgres.<ref>`), determinado por sonda: região
  errada responde "Tenant or user not found", certa responde erro de senha. `btree_gist` **não**
  está instalado — a Etapa 3 precisa criar antes da constraint de exclusão da invariante 7.
- **2026-09-10 (Etapa 2):** a senha do banco tem `@`, então vai percent-encoded (`%40`) nas duas
  URLs. Sem encoding o postgres.js até tolera, mas é sorte: o parser corta no `@` errado. O
  drizzle-kit foi testado com a forma encodada.

- **2026-09-10 (Etapa 2, revisto):** o projeto `mentoria-dev` usa o esquema **novo** de chaves do
  Supabase (`sb_publishable_...` / `sb_secret_...`), então as variáveis passaram a se chamar
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` — o que o painel entrega, para o
  copiar e colar não errar. Os nomes legados (`..._ANON_KEY`, `..._SERVICE_ROLE_KEY`) continuam
  aceitos como fallback em `env.ts` / `env.server.ts`. `service_role` segue sendo o nome do **papel
  Postgres** nas invariantes: a chave secreta é o que autentica como ele.
- **2026-09-10 (Etapa 2):** `getDb()` e `getSql()` são funções, não constantes exportadas. Constante
  avaliaria `DATABASE_URL` na importação e derrubaria `next build` sem `.env.local`. O pool fica no
  `globalThis` porque o HMR reavalia o módulo a cada salvamento.
- **2026-09-10 (Etapa 2):** Drizzle conecta como `postgres`, fora do RLS — mesma classe de risco do
  `service_role`. Para ler no escopo do usuário, use o cliente de `supabase/server.ts`, que leva o
  JWT e deixa a policy agir.
- **2026-09-10 (Etapa 2):** a barreira da invariante 5 foi verificada de verdade: importar
  `@/lib/supabase/admin` de um componente cliente derruba o `next build` com
  `'server-only' cannot be imported from a Client Component module`. O teste em
  `src/lib/supabase/server-only.test.ts` é a rede embaixo disso — pega o vazamento antes do build.
- **2026-09-10 (Etapa 2):** `vitest.config.mts` e `scripts/check-supabase.mts` usam `.mts` para
  rodar como ESM sem `"type": "module"` no `package.json`, que mexeria com os `.mjs` de config.
- **2026-09-10 (Etapa 2):** `db:push` ficou de fora do `package.json` de propósito.
- **2026-09-10 (Etapa 0):** a pasta já não tinha artefatos de Firebase no disco (removidos no
  recomeço de 2026-09-09); a limpeza foi só de texto em `CLAUDE.md` e `STATUS.md`. Não existia
  `.env.local.example` — será criado na Etapa 2 com as variáveis do Supabase.
- **2026-09-10 (Etapa 0):** `server-only`, `luxon` e `vitest` não estavam instalados, apesar de o
  prompt mandar mantê-los. Foram instalados agora, mais `@types/luxon` (só tipos, exigido pelo
  `strict`). Script `npm test` = `vitest run`.
- **2026-09-10 (Etapa 1):** fundos suaves que dependem do accent (pill `accent`, `Note` accent,
  item ativo da navegação) usam o accent com alpha (`withAlpha`) em vez de blush/deep fixos, para
  que uma empresa com accent azul não fique com destaques rosa. Blush e deep continuam na paleta
  para hover de ghost e seleção de texto. Texto sobre accent escolhido por luminância (`onAccent`).
- **2026-09-10 (Etapa 1):** `src/lib/roles.ts` concentra rota inicial, casca e navegação por papel;
  `moderator` usa a casca do `admin`. Página `/` é um índice temporário das cascas — some na
  Etapa 4, quando o middleware redirecionar por papel. Link "Trocar de casca" na sidebar só em dev.
- **2026-09-10 (Etapa 1):** SVGs do scaffold (`public/*.svg`) removidos. `README.md` continua o
  genérico do `create-next-app`; reescrever quando houver nome de plataforma.
- **2026-09-10 (Etapa 1):** a IDE sugere classes canônicas do Tailwind (`py-2.25` em vez de
  `py-[9px]`). Mantidos os valores em px para bater com o protótipo aprovado; é só aviso.
- `AGENTS.md` continua na raiz: é o bloco gerenciado do Next 16, reescrito por `next dev`; sem ele
  o Next injeta o bloco dentro do `CLAUDE.md`.
