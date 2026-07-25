# App de Mentoria — Contexto do Projeto

## O que é

Marketplace de mentoria com **oferta curada**: mentores não se cadastram, entram por convite do
admin. Mentorados recebem **moedas** periodicamente e trocam por sessões. O formato principal é
**1:1**. Mentor pode presentear uma moeda extra ao avaliar a sessão, dentro de uma cota mensal.
Existe visão de admin/moderador com personalização da plataforma.

Preparado para, no futuro, uma **empresa patrocinadora** comprar pacote de moedas para seus
colaboradores e acompanhar um painel agregado — daí o `orgId` em tudo desde o início.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind · shadcn/ui
Firebase: Auth, Firestore, Cloud Functions (southamerica-east1), Storage
Luxon (fuso/datas) · Vitest (testes) · Daily.co (vídeo) · Claude API (matching e resumos)
Z-API ou Evolution API (WhatsApp) · Vercel

---

## INVARIANTES — não violar sem pedido explícito

1. **`src/lib/scheduling/` é TypeScript puro.** Nenhum import de Firebase, nenhuma leitura de rede.
   Recebe dados, devolve slots. Depois de validada pelos testes, **está travada**.
2. **Datas sempre em UTC no banco.** Conversão só na borda de UI, com o `timezone` do usuário.
   A regra semanal do mentor é salva no fuso dele + campo `timezone` IANA.
3. **O saldo de moedas é derivado.** A verdade é `wallets/{uid}/entries` — append-only e imutável.
   `wallets/{uid}.balance` é só cache. Nunca editar nem apagar um lançamento; para corrigir,
   lançar um `adjust`.
4. **Cliente não escreve `bookings` nem `wallets`.** Security Rules negam. Só o Admin SDK escreve,
   via Cloud Function callable.
5. **`createBooking` é atômico.** Numa transação: valida slot contra o motor → debita moeda →
   cria reserva. Se qualquer etapa falhar, nada acontece.
6. **ID de reserva é determinístico:** `{mentorId}_{startAtISO}`. Impede reserva dupla por
   construção — dois pedidos simultâneos, um falha.
7. **Mentor nunca se autocadastra.** Só existe mentor vindo de `mentorInvites`.
8. **Taxonomia e textos vivem no Firestore** (`appConfig`), nunca hardcoded. Áreas, skills, cópia
   de interface, nome da moeda, regras de preço e cancelamento.
9. **`orgId` em todo documento com escopo.** Padrão `'public'` (marketplace aberto). Nunca
   consultar coleção com escopo sem filtrar por `orgId`.
10. **Sala não abre sem briefing preenchido.** Requisito, não sugestão.
11. **Toda ação de admin ou moderador gera `auditLogs`.** Inclusive publicar personalização.
12. **Moeda não é comprável nem transferível entre mentorados.** Doação só via pote intermediado
    pelo admin. Mudar isso transforma a plataforma em intermediária de pagamento.

---

## Regras de trabalho

- Cores sempre em **hex inline**, nunca CSS variables (no protótipo HTML foi exceção, para demonstrar
  tema em tempo real; no Next, ler `appConfig` e injetar hex).
- Sidebar e estados visuais via `className` condicional do Tailwind.
- **Uma feature por sessão.** Atualizar este arquivo ao final de cada sessão.
- Commits curtos, imperativo, em português.
- Security Rules e audit log evoluem **junto** com cada feature, nunca depois.
- Toda mudança em `scheduling/` ou na carteira acompanha teste.
- Protótipo HTML single-file antes de codar tela nova.

---

## Modelo de dados (Firestore)

```
orgs/{orgId}
  name, plan:'public'|'sponsor', active, coinPolicyOverride?

users/{uid}
  orgId, role:'mentee'|'mentor'|'moderator'|'admin', name, photoURL, timezone

mentors/{uid}
  orgId, status:'invited'|'onboarding'|'pending_review'|'active'|'paused'|'archived',
  headline, bio, areas[], skills[], seniority, sessionDurations[30,45], bufferMin,
  maxPerWeek, autoConfirm, giftQuotaMonthly, ratingAvg, sessionCount
mentors/{uid}/rules/{ruleId}          weekday 0-6, startMin, endMin, effectiveFrom, effectiveTo
mentors/{uid}/exceptions/{yyyy-mm-dd} type:'block'|'extra', ranges[]

mentorInvites/{token}                 orgId, email, phone, suggestedArea, expiresAt, usedAt, createdBy
mentorApplications/{id}               orgId, name, contact, pitch, status, decidedBy

bookings/{mentorId}_{startAtISO}      ← ID determinístico
  orgId, mentorId, format:'1:1'|'grupo', capacity, participants[{uid, briefingId, attended}],
  participantUids[]                   ← projeção plana de participants[].uid, só para as rules
                                        (Security Rules não navegam lista de mapas)
  startAt, endAt, durationMin, priceCoins, status:'pending'|'confirmed'|'done'|'cancelled'|'no_show',
  roomName, trackId?, createdVia:'search'|'ai'|'referral'|'reschedule'

briefings/{id}                        bookingId, uid, problem, links[], goalId?, submittedAt

wallets/{uid}                         orgId, balance (cache), expiresNextAt
wallets/{uid}/entries/{id}            ← append-only, imutável
  type:'grant'|'spend'|'refund'|'gift'|'expire'|'adjust', amount(+/-), balanceAfter,
  bookingId?, byUid?, reason, idempotencyKey, createdAt

giftQuotas/{mentorId}_{YYYYMM}        limit, used
reviews/{bookingId}_{uid}             rating, tags[], comment, gifted:boolean, visibility
goals/{id}                            orgId, uid, title, mentorIds[], progress, status
checkins/{bookingId}                  dueAt, channel:'whatsapp', answeredAt, done:boolean

asyncQuestions/{id}                   orgId, menteeId, mentorId, question, answer, mediaUrl?,
                                      dueAt, priceCoins, status
pills/{id}                            mentorId, title, mediaUrl, durationSec, areas[], published
tracks/{id}                           orgId, menteeId, goalTitle, source:'ai'|'admin',
                                      steps[{theme, mentorId?, bookingId?, done}]
waitlist/{mentorId}_{uid}             areas[], window, notifiedAt
mentorRequests/{id}                   orgId, uid, need, area, status  ← pedido reverso
referrals/{id}                        fromMentorId, toMentorId, menteeId, note, bookingId?

reports/{id}                          orgId, target:'profile'|'session'|'message', targetId, reason, status
moderationQueue/{id}                  kind:'application'|'profile'|'review'|'report', refId, status
appConfig/{orgId}                     branding, taxonomy, copy, coinPolicy, flags, version, publishedBy
auditLogs/{id}                        orgId, actorUid, action, targetRef, before, after, at
```

## Economia de moedas

| Evento | Efeito |
|---|---|
| Boas-vindas | +3 |
| Crédito mensal (dia 1º) | +3, teto de acúmulo 8 |
| Validade | 90 dias, consumo FIFO (mais antiga primeiro) |
| Sessão 30 min | −1 |
| Sessão 45 min | −2 |
| Pergunta assíncrona | −1 |
| Pílula | grátis |
| Cancelamento > 12h antes | estorno total |
| Mentorado ausente | moeda consumida |
| Mentor ausente | estorno total +1 de compensação |
| Remarcar | sem custo |
| Presente do mentor | +1 ao mentorado, −1 da cota mensal (3, não acumula) |

Todos esses números vivem em `appConfig.coinPolicy`. A tabela acima é o **default**, não o código.

Presente exige avaliação preenchida. Cota zerada esconde o botão, não o desabilita silenciosamente.

---

## Roadmap — uma fase por sessão

### MVP (F1–F9)
- **F1** Auth, papéis via custom claims, `orgId`, `appConfig` com defaults, onboarding
- **F1.5** Console admin: convite de mentor, curadoria, personalização *(caminho crítico — sem
  isso não existe mentor para testar)*
- **F2** `src/lib/scheduling/` puro + suíte Vitest, depois **travar**
- **F3** Disponibilidade do mentor: **primeiro o modo rápido "só esta semana"**, depois a grade
  semanal e as exceções
- **F4** Perfil do mentor + fluxo `pending_review` → `active`
- **F5** Carteira: livro-caixa, grants automáticos, expiração FIFO, callable `createBooking`
- **F6** Busca de mentores + reserva consumindo moeda
- **F7** Agenda nas duas visões: confirmar, cancelar, remarcar, estornos, fila de espera
- **F8** Briefing obrigatório + sala Daily com token por Cloud Function
- **F9** Encerramento: avaliação, presente, cota, moderação de nota baixa

### Pós-MVP
- **F10** Transcrição → resumo → tarefas extraídas (Claude API) + check-in de 7 dias por WhatsApp
- **F11** Assistente de IA de matching *(recebe só slots já validados pelo motor — nunca inventa horário)*
- **F12** Pergunta assíncrona
- **F13** Pílulas (catálogo curto de mentor, grátis)
- **F14** Trilha multi-mentor
- **F15** Pedido reverso + indicação entre mentores
- **F16** Formato grupo — apenas ligar `format:'grupo'` + `capacity`, sem novo modelo
- **F17** Console do patrocinador: org, pacote de moedas, painel agregado anonimizado
- **F18** Relatório de horas doadas do mentor, dashboards, auditoria completa

---

## Decisões tomadas

- Oferta curada: mentor só por convite; candidatura espontânea vai para fila, admin decide.
- Dois papéis administrativos: `admin` (curadoria, economia, personalização) e `moderator`
  (fila, denúncias, estornos — não mexe em aparência nem em regras da moeda).
- Suspender mentor tem efeito cascata: cancela sessões futuras, estorna moedas, avisa mentorados.
- `format:'grupo'` fica disponível como opção, **não como núcleo** — 1:1 é o produto.
- `orgId` desde o início com `'public'` como padrão; console do patrocinador fica para a F17.
- Vídeo: Daily.co prebuilt no MVP (WebRTC próprio não vale o custo agora).
- Notas 1 e 2 não publicam direto: passam pela moderação.

## Descartado

- Chat livre mentor↔mentorado a qualquer hora (destrói o limite do mentor e a escassez da moeda).
  Se voltar, só na janela de 24h ao redor da sessão.
- Ranking público de mentorados.
- Gravação ligada por padrão.
- Marketplace de cursos.

## Em aberto

- Mentor ganha moeda por hora doada? (interruptor já previsto em `appConfig.coinPolicy`)
- Mentorado ganha moeda por contribuir — risco de ser burlado, avaliar depois.
- Nome da moeda na interface (configurável, default "moeda").

---

## Estado atual

Fase: **F0 concluída + scaffold conectado ao Firebase** — protótipo HTML single-file validado
(três visões, economia de moedas, momento do presente), projeto Next.js criado e a fundação de
infraestrutura fechada. Nenhuma feature de negócio ainda.
Próxima sessão: **F1** (onboarding, perfil, fuso do usuário, grants de boas-vindas).

### O que o scaffold já tem

```
src/app/
  (auth)/login              login Google + ensureUserBootstrap
  (mentee)/                 /inicio /mentores /agenda /carteira
  (mentor)/                 /mentor /mentor/disponibilidade /mentor/agenda
  (admin)/                  /admin /admin/mentores /admin/personalizacao
  api/health/route.ts       teste de fumaça: escreve e lê `_health/ping` pelo Admin SDK
src/lib/auth/               ROLES, readClaims (fallback seguro), AuthProvider, RoleGate
src/lib/config/             tipos + DEFAULT_APP_CONFIG (tabela de economia) + leitor server-side
src/lib/env.ts              required / requiredEnv / optionalEnv — erro nomeia a variável
src/lib/firebase/           config.ts (env do SDK web), client.ts (SDK web), admin.ts (Admin SDK)
src/lib/firestore/scoped.ts withOrgScope / assertSameOrg — invariante 9
src/lib/scheduling/         só o README com o invariante 1; a F2 começa pelos testes
functions/                  southamerica-east1: ensureUserBootstrap, setUserRole (+ auditLog)
scripts/                    seed-app-config.ts, set-claims.ts, dev-emu.mjs
.firebaserc                 alias default → projeto `mentoria`
firebase.json               firestore + storage + functions + emuladores (singleProjectMode)
firestore.rules             deny-by-default; bookings e wallets somente leitura para o cliente
```

Comandos: `npm run dev` · `npm run dev:emu` · `npm run emu` · `npm test` ·
`npm run typecheck` · `npm run build` · `npm run rules:test` (placeholder até a F5) ·
`npm run seed:config` · `npm run claims:set -- --email x@y.com --role admin`.
Configuração de ambiente em `.env.local.example` → `.env.local`. Etapas manuais de console em
`docs/SETUP.md`; visão geral no `README.md`.

### Decisões do scaffold

- **Papéis vivem em custom claims** (`role`, `orgId`); `users/{uid}` só espelha, e as rules
  proíbem o cliente de tocar nesses dois campos. `readClaims` faz fallback para
  `mentee`/`public` — nunca para staff.
- **`RoleGate` é navegação, não segurança.** Quem manda são as rules e a checagem de claims
  dentro de cada callable.
- **`setUserRole` recusa `role:'mentor'`** para não furar o invariante 7. Promoção a mentor entra
  na F1.5, junto com `mentorInvites`.
- **`ensureUserBootstrap`** é o único caminho para criar `users/{uid}` e as claims iniciais;
  idempotente.
- Leitura de env é **preguiçosa** (`getFirebaseConfig()`), para `next build` rodar sem `.env.local`
  e o erro aparecer com o nome da variável faltando.
- **Credencial do Admin SDK são três variáveis** (`FIREBASE_ADMIN_PROJECT_ID`,
  `_CLIENT_EMAIL`, `_PRIVATE_KEY`), não o JSON inteiro. O arquivo da conta de serviço nunca entra
  no repositório — copia-se os três campos e apaga.
- `src/lib/env.ts` tem **duas portas de propósito**: `required(nome, valor)` para variáveis que vão
  ao browser (o Next só inlina `NEXT_PUBLIC_*` em acesso **estático**; índice dinâmico chega
  `undefined` no bundle) e `requiredEnv(nome)` para código só de servidor.
- **`NEXT_PUBLIC_USE_EMULATORS=true` desliga a credencial**: `admin.ts` aponta
  `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` e usa `applicationDefault()`. É o que
  faz `npm run dev:emu` rodar sem conta de serviço nenhuma.
- `scripts/dev-emu.mjs` existe porque `VAR=valor comando` não funciona no shell do Windows, e o
  setup fechou a porta para `cross-env`/`dotenv-cli`.
- `functions/src/lib/roles.ts` é **cópia proposital** de `src/lib/auth/roles.ts` — pacotes npm
  separados. Mudou papel, mudou nos dois.
- Testes de economia (`defaults.test.ts`) travam a tabela do CLAUDE.md contra a semente.

### Pendências conhecidas

- **Java ausente na máquina** — os emuladores de Auth e Firestore rodam em JVM, então `npm run emu`
  não sobe e `firestore.rules` segue **sem compilação local**. Instalar um JDK
  (`winget install EclipseAdoptium.Temurin.21.JDK`) e validar em `http://127.0.0.1:4000`.
  Enquanto isso, `/api/health` só foi exercitado contra as regras, não contra o emulador.
- **Plano Spark**: Cloud Functions não implantam. Tudo em emulador; migrar para Blaze e configurar
  alerta de orçamento **antes da F5** (`createBooking` é callable — invariante 5).
- `firebase.json` declara runtime **`nodejs22`** (não 20), casando com `functions/package.json`.
- Sem teste de rules (`@firebase/rules-unit-testing`) — entra junto com a F5, onde negar escrita
  em `wallets` passa a valer dinheiro. `npm run rules:test` é placeholder até lá.
