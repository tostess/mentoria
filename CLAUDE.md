# App de Mentoria — Contexto do Projeto

## O que é

Marketplace de mentoria com **oferta curada**: mentores não se cadastram, entram por convite do
admin. Mentorados recebem **moedas** periodicamente e trocam por sessões 1:1 de 30 ou 45 minutos,
por vídeo, dentro do app. Mentor pode presentear uma moeda extra ao avaliar a sessão, dentro de uma
cota mensal. Existe visão de admin/moderador com personalização da plataforma.

Preparado para, no futuro, uma **empresa patrocinadora** comprar pacote de moedas para seus
colaboradores — daí o `orgId` em tudo desde o início.

Aplicação **web responsiva**, pt-BR apenas. Não é app nativo de loja.

## Stack

Next.js (App Router) — versão: **16.3.4** · TypeScript strict · Tailwind ·
Firebase Auth + Firestore + Storage · Admin SDK em Route Handlers · Vercel (região `gru1`) ·
Vercel Cron · Luxon · Vitest · Daily.co (vídeo) · Claude API (matching, resumo) · Z-API
(WhatsApp) · Resend (e-mail transacional).

Sem Cloud Functions. Sem triggers do Firestore. Tudo que é reativo acontece na rota que causou o
evento; tudo que é periódico acontece em cron.

---

## INVARIANTES — não violar sem pedido explícito

1. **`src/lib/scheduling/` é TypeScript puro.** Sem Firebase, sem rede. Depois de validado pelos
   testes, está **travado**.
2. **Datas em UTC no banco.** Conversão só na borda de UI, com o `timezone` do usuário. Regra semanal
   do mentor é salva no fuso dele + campo `timezone` IANA.
3. **Saldo de moedas é derivado.** A verdade é `wallets/{uid}/entries` — append-only, imutável.
   `balance` é cache. Correção é um `adjust`, nunca edição.
4. **Cliente não escreve `bookings` nem `wallets`.** Security Rules negam. Toda escrita privilegiada
   passa por Route Handler com Admin SDK.
5. **Criação de reserva é atômica.** `POST /api/bookings` faz, numa única transação: validar slot
   contra o motor → debitar → criar reserva. Falhou uma etapa, nada acontece.
6. **ID de reserva é determinístico:** `{mentorId}_{startAtISO}`. Dois pedidos simultâneos, um falha.
7. **Mentor nunca se autocadastra.** Só existe mentor vindo de `mentorInvites`.
8. **Taxonomia, textos e política vivem em `appConfig`**, nunca no código.
9. **`orgId` em todo documento com escopo.** Padrão `'public'`. Nunca consultar sem filtrar.
10. **Sala não abre sem briefing preenchido.**
11. **Toda ação de admin ou moderador gera `auditLogs`.** Inclusive publicar personalização.
12. **Moeda não é comprável nem transferível entre mentorados.** Doação só via pote intermediado.
13. **O assistente recomenda pessoas, nunca horários.** Considera todos os mentores ativos, com ou
    sem vaga. Todo horário exibido vem do motor. Mentor sem vaga aparece com fila de espera ou
    pergunta assíncrona no lugar dos slots.
14. **Sinal de demanda é agregado e anônimo.** Mentor vê quantidades por semana, nunca quem.
15. **Trabalho agendado é idempotente.** Lançamento por cron usa `idempotencyKey` determinística
    (`grant_{uid}_{YYYYMM}`, `expire_{entryId}`, `reminder24_{bookingId}`) e falha se já existir.
16. **Production → `mentoria`; Preview e Development → `mentoria-dev`.** Preview nunca escreve em
    produção.
17. **Presença é derivada da sala, não declarada.** O webhook do Daily.co marca `attended` por
    participante. O mentor só **corrige** na avaliação, e a correção gera audit log. Sem isso, a
    penalidade por falta não é aplicável.
18. **Papel é verificado no servidor em toda rota privilegiada**, via custom claim decodificado
    pelo Admin SDK. Nunca confiar em campo `role` de documento.

---

## Regras de trabalho

- Cores em **hex inline** via valores arbitrários do Tailwind (`bg-[#C2317A]`). Nunca CSS variables
  para cor. Quando a cor vier de `appConfig.branding`, usar `style` inline.
- Estados visuais via `className` condicional.
- **Uma feature por sessão.** Atualizar `CLAUDE.md` e `STATUS.md` ao final de cada sessão.
- Commits curtos, imperativo, em português.
- Security Rules e audit log evoluem **junto** com cada feature.
- Toda mudança em `scheduling/`, carteira ou rules acompanha teste.
- Protótipo HTML single-file antes de codar tela nova.
- Rotas que chamam a Claude API exportam `maxDuration`; conferir o teto vigente do plano da Vercel
  antes de definir — não chutar.
- Busca de mentores é **filtro no cliente** sobre a lista de ativos cacheada. Com menos de 200
  mentores, nenhum serviço de busca externo.
- Sem `any`. Sem dependência nova sem registrar aqui.

---

## Sistema de design (aprovado pelo cliente — não reinventar)

| Papel | Hex | Uso |
|---|---|---|
| ink | `#2A1B26` | texto principal, marca escura |
| mist | `#FDF8FB` | fundo da página |
| white | `#FFFFFF` | superfícies, sidebar |
| blush | `#FCEDF4` | destaque suave, item ativo, aviso |
| magenta | `#C2317A` | ação primária (default de `branding.accent`) |
| deep | `#8E1E58` | texto sobre blush, hover |
| line | `#F3E4EC` | bordas |
| line2 | `#EAD6E1` | bordas de input |
| stone | `#8E7C86` | texto secundário |
| gold | `#C98A2E` | moeda — único tom quente do sistema |
| gold-soft | `#FBF1DE` | fundo da moeda |
| success | `#2E6B52` / `#EAF6F0` | confirmada, estorno |
| danger | `#A63A2E` / `#FBEAE7` | denúncia, suspender |

Fontes: **Darker Grotesque** (títulos, 600/700), **Instrument Sans** (corpo), **IBM Plex Mono**
(horários, números, rótulos em caixa alta com tracking). Raio padrão 14px, botões 10px, chips 8px.

Princípios: muito branco; rosa como estrutura, não como decoração; a moeda é a única coisa dourada
e deve parecer moeda, não botão; o momento do presente é o único lugar com animação.

---

## Modelo de dados (Firestore)

```
orgs/{orgId}                          name, plan:'public'|'sponsor', active
users/{uid}                           orgId, role, name, photoURL, timezone, notifPrefs{whatsapp,email},
                                      phone?, deletedAt?
mentors/{uid}                         orgId, status:'invited'|'onboarding'|'pending_review'|'active'|
                                      'paused'|'archived', headline, bio, areas[], skills[], seniority,
                                      sessionDurations[], bufferMin, maxPerWeek, autoConfirm, timezone,
                                      giftQuotaMonthly, ratingAvg, ratingCount, sessionCount
mentors/{uid}/rules/{ruleId}          weekday, startMin, endMin, effectiveFrom, effectiveTo
mentors/{uid}/exceptions/{yyyy-mm-dd} type:'block'|'extra', ranges[]
mentorInvites/{token}                 orgId, email, phone, suggestedArea, expiresAt, usedAt, createdBy
mentorApplications/{id}               orgId, name, contact, pitch, status, decidedBy

bookings/{mentorId}_{startAtISO}      orgId, mentorId, format:'1:1'|'grupo', capacity,
                                      participants[{uid, briefingId, attended:boolean|null}],
                                      startAt, endAt, durationMin, priceCoins,
                                      status:'pending'|'confirmed'|'done'|'cancelled'|'no_show_mentee'|
                                      'no_show_mentor'|'expired', roomName?, trackId?,
                                      createdVia:'search'|'ai'|'referral'|'reschedule',
                                      cancelledBy?, cancelledAt?, confirmedAt?
briefings/{id}                        bookingId, uid, problem, links[], goalId?, submittedAt
sessionEvents/{id}                    bookingId, uid?, kind:'joined'|'left'|'room_created', at, raw
                                      ← escrito só pelo webhook do Daily

wallets/{uid}                         orgId, balance (cache), lastEntryAt
wallets/{uid}/entries/{id}            type:'grant'|'spend'|'refund'|'gift'|'expire'|'adjust', amount,
                                      balanceAfter, bookingId?, byUid?, reason, idempotencyKey,
                                      expiresAt?, createdAt                        ← imutável
giftQuotas/{mentorId}_{YYYYMM}        limit, used
reviews/{bookingId}_{uid}             rating, tags[], comment, gifted, attendedOverride?, visibility
goals/{id}                            orgId, uid, title, mentorIds[], progress, status
checkins/{bookingId}                  dueAt, channel, answeredAt?, done?

notifications/{uid}/items/{id}       kind, title, body, link, readAt?, sentVia[], createdAt
asyncQuestions/{id}                   orgId, menteeId, mentorId, question, answer?, mediaUrl?, dueAt,
                                      priceCoins, status:'open'|'answered'|'expired_refunded'
pills/{id}                            mentorId, title, mediaUrl, durationSec, areas[], published
tracks/{id}                           orgId, menteeId, goalTitle, source, steps[]
waitlist/{mentorId}_{uid}             areas[], window, notifiedAt?
mentorRequests/{id}                   orgId, uid, need, area, status
referrals/{id}                        fromMentorId, toMentorId, menteeId, note, bookingId?

suggestionEvents/{id}                 orgId, mentorId, uid, at, kind:'suggested'|'viewed'|'blocked'|
                                      'waitlisted', source, requestedWindow?, ttlAt   ← TTL 90 dias
mentorDemand/{mentorId}_{YYYY-WW}     suggested, viewed, blocked, waitlisted, topWindows[], areas[]

reports/{id}                          orgId, target, targetId, reason, status
moderationQueue/{id}                  kind:'application'|'profile'|'review'|'report', refId, status
appConfig/{orgId}                     branding, taxonomy, copy, coinPolicy, limits, flags, version,
                                      publishedBy, publishedAt
auditLogs/{id}                        orgId, actorUid, action, targetRef, before, after, at
```

### Máquina de estados da sessão

```
pending ──confirmar──▶ confirmed ──fim + 15min──▶ done
   │                      │
   │ 48h sem resposta     ├──cancelar──▶ cancelled (estorno se > cancelWindowHours)
   ▼                      ├──ninguém entrou / só mentor──▶ no_show_mentee (moeda consumida)
expired (estorno)         └──só mentorado entrou──▶ no_show_mentor (estorno + compensação)
```

Transições para `done` e `no_show_*` são feitas pelo cron `close-sessions`, lendo `sessionEvents`.
O mentor pode contestar na avaliação (`attendedOverride`), e isso gera audit log.

### Economia de moedas — defaults em `appConfig.coinPolicy`

| Chave | Default |
|---|---|
| `welcomeGrant` | 3 |
| `monthlyGrant` | 3 |
| `maxBalance` | 8 |
| `expiryDays` | 90, consumo FIFO |
| `price30` / `price45` | 1 / 2 |
| `priceAsyncQuestion` | 1 |
| `cancelWindowHours` | 12 |
| `mentorNoShowBonus` | 1 |
| `giftQuotaMonthly` | 3, não acumula |
| `giftRequiresReview` | true |

### Limites — `appConfig.limits`

| Chave | Default |
|---|---|
| `bookingHorizonDays` | 14 |
| `maxPendingPerMentee` | 2 |
| `pendingExpiresHours` | 48 |
| `asyncAnswerHours` | 48 |
| `minNoticeHours` | 12 |
| `sessionGraceMinutes` | 15 |

### Trabalho agendado (Vercel Cron, todos idempotentes)

| Job | Cadência | Fase |
|---|---|---|
| `grant-monthly` | dia 1º, 03:00 | F5 |
| `expire-coins` | diário | F5 |
| `expire-pending` | a cada hora | F7 |
| `close-sessions` | a cada 15 min | F7 |
| `send-reminders` (24h e 1h) | a cada 15 min | F8 |
| `checkin-7d` | diário | F10 |
| `aggregate-demand` | semanal | F11 |
| `refund-unanswered` | diário | F12 |

### Vídeo

Sala Daily.co criada **sob demanda** no primeiro `join`, com nome = `bookingId`. Token por
participante com `nbf` = início − 10 min e `exp` = fim + 15 min. Webhook grava `sessionEvents`.
Gravação desligada por padrão.

### Notificações

Canais: in-app (sempre), e-mail (Resend), WhatsApp (Z-API, só com consentimento e telefone).
Eventos: reserva confirmada, lembrete 24h, lembrete 1h, cancelamento, horário aberto (fila de
espera), presente recebido, pergunta respondida, check-in.

### Exclusão de conta (LGPD)

`users/{uid}` recebe `deletedAt` e tem nome, foto, e-mail e telefone substituídos por marcadores.
`wallets/{uid}/entries`, `bookings` e `auditLogs` **não são apagados** — são imutáveis por
construção. Reviews têm o autor anonimizado. Auth é removido.

---

## Roadmap — uma fase por sessão

### Base (este prompt)
- **Etapas 0–5:** contrato, design system, conexão, auth/papéis/config, motor de agenda, rules.

### MVP
- **F1.5** Console admin: convite, curadoria, personalização, fila de decisões
- **F3** Disponibilidade: **modo rápido "só esta semana" primeiro**, depois grade e exceções
- **F4** Perfil do mentor, `pending_review → active`
- **F5** Carteira: boas-vindas, `grant-monthly`, `expire-coins`, `POST /api/bookings`
- **F6** Busca (filtro cliente) + reserva consumindo moeda + limites anti-abuso
- **F7** Agenda nas duas visões, confirmar/cancelar/remarcar, estornos, `expire-pending`,
  `close-sessions`, fila de espera com notificação ao abrir horário
- **F8** Briefing obrigatório, sala Daily, webhook, `send-reminders`
- **F9** Encerramento: avaliação, presente, cota, contestação de presença, moderação de nota baixa

### Pós-MVP
- **F10** Transcrição → resumo → tarefas (Claude API) + `checkin-7d`
- **F11** Assistente de IA + sinal de demanda + `aggregate-demand` + painel de demanda por mentor
- **F12** Pergunta assíncrona + `refund-unanswered`
- **F13** Pílulas · **F14** Trilha multi-mentor · **F15** Pedido reverso + indicação
- **F16** Formato grupo (só ligar `format:'grupo'`) · **F17** Console do patrocinador
- **F18** Relatório de horas do mentor, dashboards, exclusão de conta

---

## Decisões tomadas

- Oferta curada por convite; candidatura espontânea vai para fila, admin decide.
- `admin` (curadoria, economia, personalização) e `moderator` (fila, denúncias, estornos).
- Suspender mentor cascateia: cancela futuras, estorna, avisa, sugere substituto.
- 1:1 é o produto; `format:'grupo'` é opção.
- IA recomenda entre todos os ativos; resultado em dois níveis (melhor encaixe / disponível agora).
- Sinal de demanda agregado; `blocked` é a métrica principal; sem ranking público.
- Cloud Functions substituídas por Route Handlers: Vercel paga, um deploy só, sem Blaze.
  Contrapartida: sem triggers.
- Presença derivada de webhook do Daily; mentor só corrige.
- Lembretes 24h/1h como principal defesa contra falta.
- Notas 1 e 2 passam pela moderação antes de publicar.
- Busca no cliente; sem Algolia.

## Descartado

- Chat livre mentor↔mentorado fora da janela de 24h da sessão.
- Ranking público de mentorados ou mentores.
- Gravação ligada por padrão.
- Marketplace de cursos.

## Em aberto

- Mentor ganha moeda por hora doada? (`flags.mentorEarnsCoins`, default false)
- Mentorado ganha moeda por contribuir? Risco de burla.
- Nome da moeda (configurável, default "moeda").

---

## Estado atual

Etapa: **0** — contrato escrito, terreno verificado.
Motor de agenda: **não travado ainda**.
