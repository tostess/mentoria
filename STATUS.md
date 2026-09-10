# STATUS

Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit final.

| Data | Etapa | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-10 | 1 | Fontes via `next/font`; 11 componentes em `components/ui`; `theme.ts` com `resolveTheme`; `terms.ts`; shell com sidebar 246px e bloco de topo por papel; grupos `(auth)`, `(professional)`, `(partner)`, `(org)`, `(admin)` com 17 páginas vazias; `/design` só em dev com seletor de accent | Nome da plataforma é placeholder ("Mentoria") até `app_config` | `761d11d` |
| 2026-09-10 | 0 | Contrato migrado para Supabase; artefatos de Firebase removidos; `npm run build` verde | — | `27ff6d7` |

## Bloqueios abertos
_(nenhum)_

## Decisões de sessão
_(dependência escolhida, atalho tomado, dívida assumida — o que não merece o CLAUDE.md)_

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
