# STATUS

Registro por sessão. Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit
final de cada sessão.

| Data | Etapa/Fase | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-09 | Etapa 0 | CLAUDE.md e STATUS.md criados; terreno verificado; pasta recomeçada do zero; scaffold Next 16.3.4 (`create-next-app@latest`); `npm run build` verde | Java ausente (emuladores); `.env.local` não preenchido | _(preencher na Etapa 1)_ |

## Bloqueios abertos

- **Java ausente na máquina.** Os emuladores de Auth e Firestore rodam em JVM. Sem JDK,
  `npm run emu` não sobe — afeta o aceite da Etapa 2 e todo `test:rules` da Etapa 5.
  Sugestão: `winget install EclipseAdoptium.Temurin.21.JDK`.
- **`.env.local` não existe.** O aceite da Etapa 2 (`/api/health` contra o Firestore real) precisa
  das três variáveis do Admin SDK preenchidas. O arquivo é criado à mão a partir do
  `.env.local.example`, nunca pelo assistente.

## Decisões tomadas em sessão

- **Recomeço do zero** (2026-09-09): o scaffold anterior (Cloud Functions, rules abertas, CLAUDE.md
  antigo) foi removido por contradizer o novo contrato ("Sem Cloud Functions"). O histórico continua
  no git até o commit `0e5aaf7`. Só `.git` e o protótipo HTML foram preservados.
- Protótipo `prototipo-mentoria-f0-v2.html` movido da raiz para `docs/`.
- Dependências extras do scaffold antigo (clsx, tailwind-merge, class-variance-authority,
  lucide-react, tsx, dotenv) **não** voltaram. Só entram se uma etapa exigir, e com aviso prévio.
- Scaffold gerado em pasta temporária e copiado, para que CLAUDE.md e STATUS.md fossem os
  primeiros arquivos do projeto. `create-next-app` recusa rodar em pasta com arquivos.
- **`AGENTS.md` fica na raiz.** É o bloco gerenciado do Next 16, reescrito por `next dev`. Sem ele,
  o Next injeta o bloco dentro do `CLAUDE.md` (ver
  `node_modules/next/dist/server/lib/generate-agent-files.js`). Mantê-lo protege o contrato.
- `tsconfig.json`, `eslint.config.mjs` e `.gitignore` são os do scaffold; a Etapa 2 completa o
  `.gitignore` com os padrões do Firebase.
