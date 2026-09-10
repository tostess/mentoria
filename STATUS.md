# STATUS

Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit final.

| Data | Etapa | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-10 | 2 | `.env.local.example`; `env.ts` público e `env.server.ts` com `server-only`; clientes `supabase/client`, `server` e `admin`; Drizzle sobre postgres.js com pool cacheado; `drizzle.config.ts` gerando em `supabase/migrations/` com prefixo `supabase`; `vercel.json` em `gru1`; `GET /api/health`; `npm run check:supabase`; teste estático da invariante 5 | Falta `.env.local` real: nada foi conectado a um projeto Supabase ainda | `7b308da` |
| 2026-09-10 | 1 | Fontes via `next/font`; 11 componentes em `components/ui`; `theme.ts` com `resolveTheme`; `terms.ts`; shell com sidebar 246px e bloco de topo por papel; grupos `(auth)`, `(professional)`, `(partner)`, `(org)`, `(admin)` com 17 páginas vazias; `/design` só em dev com seletor de accent | Nome da plataforma é placeholder ("Mentoria") até `app_config` | `761d11d` |
| 2026-09-10 | 0 | Contrato migrado para Supabase; artefatos de Firebase removidos; `npm run build` verde | — | `27ff6d7` |

## Bloqueios abertos

- **`.env.local` pela metade.** `mentoria-dev` existe (ref `pcoqllmquntaidttsvek`) e o Auth
  responde com a chave publishable — conexão real verificada. Faltam três valores para a Etapa 3
  poder rodar migração: `SUPABASE_SECRET_KEY`, `DATABASE_URL` (transaction pooler, 6543) e
  `DIRECT_URL` (session pooler, 5432). Rodar `npm run check:supabase` até dar tudo verde.
- **Projeto `mentoria` (produção) ainda não criado.** Invariante 17. Não bloqueia o piloto local.

## Decisões de sessão
_(dependência escolhida, atalho tomado, dívida assumida — o que não merece o CLAUDE.md)_

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
