# STATUS

Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit final.

| Data | Etapa | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-10 | 0 | Contrato migrado para Supabase; artefatos de Firebase removidos | — | — |

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
- `AGENTS.md` continua na raiz: é o bloco gerenciado do Next 16, reescrito por `next dev`; sem ele
  o Next injeta o bloco dentro do `CLAUDE.md`.
