# App de Mentoria — Contexto do Projeto

## O que é

Plataforma **B2B de mentoria corporativa**, vendida para RHs. A empresa contratante compra um bloco
de **fichas** e o RH distribui entre colaboradores selecionados. Cada ficha vale uma sessão 1:1 de
30 minutos, por vídeo, dentro da plataforma.

Os **Parceiros de Desenvolvimento** são curados e convidados pela operadora da plataforma e atendem
profissionais de todas as empresas contratantes. Os **Profissionais** pertencem a uma empresa só.

Nicho provável: educação superior e saúde. Web responsiva, pt-BR. Não é app nativo de loja.

### Vocabulário — em toda a interface, sem exceção

| Conceito | Termo | Forma curta |
|---|---|---|
| Mentor | Parceiro de Desenvolvimento | **Parceiro** |
| Mentorado | Profissional | Profissional |
| Moeda | ficha / fichas | ficha |

Tratamento **você**. Tom profissional e próximo. Todos os termos vivem em `app_config.copy.terms`,
lidos por `src/lib/terms.ts`, e são sobrescrevíveis por empresa. Nenhum termo de domínio hardcoded.

## Stack

Next.js 16.3.4 (App Router) · TypeScript strict · Tailwind · shadcn/ui ·
**Supabase Postgres (São Paulo) com RLS** · **Drizzle** (schema + migrations + queries tipadas) ·
Supabase Auth (`role` e `org_id` como claims no JWT) · Supabase Storage ·
Vercel (`gru1`) · Vercel Cron · Luxon · Vitest · Daily.co · Claude API · Z-API · Resend.
Dev: `drizzle-kit` (gera migração), `dotenv` (só o `drizzle.config.ts` — o Next lê `.env.local` sozinho).

Escolhida por RLS (protege o multi-tenant), constraints (garantem o livro-caixa) e SQL (relatório
vira query, não cron de pré-agregação).

---

## INVARIANTES — não violar sem pedido explícito

1. **`src/lib/scheduling/` é TypeScript puro.** Sem banco, sem rede. Validado por testes, fica
   **travado**.
2. **Datas em `timestamptz`.** Conversão só na borda de UI. Regra semanal do Parceiro é minutos
   desde a meia-noite **no fuso dele** + campo `timezone` IANA.
3. **Saldo é derivado do livro-caixa.** `wallet_ledger` e `org_ledger` são append-only, com trigger
   que bloqueia `update` e `delete`. O campo `balance` é mantido por trigger e protegido por
   `check (balance >= 0)`. Correção é `adjust`, nunca edição.
4. **Cliente nunca escreve em `bookings`, `wallets`, `wallet_ledger`, `org_wallets` nem
   `org_ledger`.** Não existe policy de `insert`/`update`/`delete` para papel autenticado. Toda
   escrita privilegiada passa por Route Handler com `service_role`.
5. **`service_role` só existe no servidor** — `src/lib/supabase/admin.ts` e Route Handlers. Nunca
   em componente cliente, nunca em variável `NEXT_PUBLIC_`.
6. **Reserva e alocação são transações SQL.** Reserva: validar slot → inserir `spend` → inserir
   booking. Alocação: `allocate` negativo no `org_ledger` e positivo no `wallet_ledger`. Uma falha
   derruba tudo.
7. **Sobreposição é impedida pelo banco**, não pelo código: constraint de exclusão em `bookings`
   sobre `(partner_id, tstzrange(start_at, end_at))` para status ativos. Isso cobre inclusive a
   sessão estendida de 30 para 60 minutos.
8. **Parceiro nunca se autocadastra.** Só via `partner_invites`. Candidatura espontânea entra em
   `partner_applications` e só vira Parceiro por decisão do admin.
9. **Escopo é assimétrico e isso é intencional:** `partners` pertencem à **plataforma** e são
   visíveis a todas as empresas; `profiles`, `wallets`, `bookings`, `briefings`, `reviews`, `goals`
   são **da empresa**. O isolamento é garantido por RLS, não por lembrar de filtrar.
10. **O RH nunca vê conteúdo de sessão.** `org_admin` não tem policy de leitura em `bookings`,
    `briefings`, `reviews` nem `session_events`. Vê apenas `org_usage`. Sem essa garantia ninguém
    usa a plataforma com sinceridade — é argumento de venda, não limitação.
11. **Sala não abre sem briefing** (a partir da fase em que existir).
12. **Toda ação de admin, moderador ou RH grava `audit_logs`.**
13. **Ficha não é comprável pelo profissional nem transferível entre profissionais.**
14. **O assistente recomenda pessoas, nunca horários.** Considera todos os Parceiros ativos, com ou
    sem vaga. Todo horário exibido vem do motor.
15. **Sinal de demanda é agregado e anônimo.** Nunca quem, nunca de qual empresa.
16. **Trabalho agendado é idempotente**, via `idempotency_key` única
    (`alloc_{userId}_{YYYYMM}`, `reminder24_{bookingId}`, `nudge_{userId}_{YYYYWW}`).
17. **Production → `mentoria`; Preview e Development → `mentoria-dev`.**
18. **Presença é derivada da sala.** Webhook do Daily grava `session_events`. O Parceiro só
    **corrige**, e a correção grava `audit_logs`.
19. **Papel e `org_id` são lidos do JWT no servidor**, nunca de campo de tabela.
20. **Extensão de sessão é decidida dentro da sala.** Exige `canExtend` verdadeiro e prorroga o
    token do vídeo. Não custa ficha ao profissional.

---

## Papéis

| Papel | Quem é | Pode |
|---|---|---|
| `admin` | operadora da plataforma | empresas, contratos, curadoria de Parceiros, economia, personalização |
| `moderator` | delegado da operadora | fila, denúncias, avaliações, estornos — não mexe em contrato nem aparência |
| `org_admin` | RH da empresa | saldo do contrato, selecionar colaboradores, alocar fichas, utilização agregada |
| `partner` | Parceiro | agenda, disponibilidade, perfil, sessões, sinal de demanda |
| `professional` | colaborador | buscar Parceiro, agendar, participar, avaliar |

---

## Regras de trabalho

- Cores em **hex inline** (`bg-[#C2317A]`), nunca CSS variables. O accent vem de `resolveTheme()`.
- Estados visuais via `className` condicional.
- **Uma feature por sessão.** Atualizar `CLAUDE.md` e `STATUS.md` ao final.
- Commits curtos, imperativo, em português.
- RLS e audit log evoluem **junto** com cada feature.
- Toda mudança em `scheduling/`, livros-caixa ou policies acompanha teste.
- Migração é sempre arquivo versionado em `supabase/migrations/`. Nunca alterar esquema pelo painel.
- Protótipo HTML single-file antes de codar tela nova.
- Rotas que chamam a Claude API exportam `maxDuration`; conferir o teto do plano da Vercel.
- Busca de Parceiros é filtro no cliente sobre a lista de ativos cacheada. Sem serviço externo
  abaixo de 200 Parceiros.
- Sem `any`. Sem dependência nova sem registrar aqui.

---

## Sistema de design

Paleta **default da plataforma** — o produto é white-label e cada empresa sobrescreve
`branding.accent` e o logotipo. A cliente ainda não tem marca.

| Papel | Hex |
|---|---|
| ink | `#2A1B26` |
| mist | `#FDF8FB` |
| white | `#FFFFFF` |
| blush | `#FCEDF4` |
| accent (default) | `#C2317A` |
| deep | `#8E1E58` |
| line | `#F3E4EC` |
| line2 | `#EAD6E1` |
| stone | `#8E7C86` |
| gold | `#C98A2E` |
| gold-soft | `#FBF1DE` |
| success | `#2E6B52` / `#EAF6F0` |
| danger | `#A63A2E` / `#FBEAE7` |

Fontes: **Darker Grotesque** (títulos 600/700), **Instrument Sans** (corpo), **IBM Plex Mono**
(horários, números, rótulos em caixa alta). Raio 14px, botões 10px, chips 8px.

Princípios: muito branco; o accent é estrutura, não decoração; a ficha é a única coisa dourada e
deve parecer ficha, não botão; presente e extensão são os únicos momentos com animação.

---

## Esquema — DDL canônica

```sql
create extension if not exists btree_gist;

create type user_role       as enum ('admin','moderator','org_admin','partner','professional');
create type partner_status  as enum ('invited','onboarding','pending_review','active','paused','archived');
create type booking_status  as enum ('pending','confirmed','done','cancelled',
                                     'no_show_professional','no_show_partner','expired');
create type ledger_type     as enum ('purchase','allocate','spend','refund','gift','reclaim','adjust');
create type engagement_type as enum ('voluntario','parceria','remunerado');

-- ---------- empresas ----------
create table orgs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  cnpj              text,
  active            boolean not null default true,
  contracted_fichas int not null default 0 check (contracted_fichas >= 0),
  contract_start    date,
  contract_end      date,
  branding          jsonb,
  created_by        uuid,
  created_at        timestamptz not null default now()
);

create table org_wallets (
  org_id        uuid primary key references orgs(id) on delete restrict,
  balance       int not null default 0 check (balance >= 0),
  last_entry_at timestamptz
);

create table org_ledger (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete restrict,
  type            ledger_type not null,
  amount          int not null check (amount <> 0),
  balance_after   int not null,
  to_user_id      uuid,
  by_user_id      uuid,
  reason          text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);

-- ---------- pessoas ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references orgs(id),
  role        user_role not null,
  name        text not null,
  email       text not null,
  photo_url   text,
  timezone    text not null default 'America/Sao_Paulo',
  job_title   text,
  area        text,
  phone       text,
  notif_prefs jsonb not null default '{"email":true,"whatsapp":false}'::jsonb,
  active      boolean not null default true,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  -- invariante 9 no esquema: só profissional e RH pertencem a uma empresa
  constraint profiles_org_scope
    check ((role in ('professional','org_admin')) = (org_id is not null))
);

create table wallets (
  user_id       uuid primary key references profiles(id) on delete cascade,
  org_id        uuid not null references orgs(id),
  balance       int not null default 0 check (balance >= 0),
  last_entry_at timestamptz,
  last_used_at  timestamptz
);

create table wallet_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references wallets(user_id) on delete restrict,
  org_id          uuid not null references orgs(id),
  type            ledger_type not null,
  amount          int not null check (amount <> 0),
  balance_after   int not null,
  booking_id      uuid,
  by_user_id      uuid,
  reason          text,
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);

-- ---------- parceiros (escopo plataforma) ----------
create table partners (
  id                      uuid primary key references profiles(id) on delete cascade,
  status                  partner_status not null default 'invited',
  headline                text,
  bio                     text,
  areas                   text[] not null default '{}',
  skills                  text[] not null default '{}',
  seniority               text,
  buffer_min              int not null default 15 check (buffer_min >= 0),
  max_per_week            int not null default 4  check (max_per_week > 0),
  auto_confirm            boolean not null default false,
  engagement              engagement_type not null default 'voluntario',
  contracted_hours_monthly numeric,
  gift_quota_monthly      int not null default 3,
  extension_quota_monthly int not null default 3,
  rating_avg              numeric,
  rating_count            int not null default 0,
  session_count           int not null default 0,
  approved_by             uuid,
  approved_at             timestamptz
);

create table partner_rules (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references partners(id) on delete cascade,
  weekday        smallint not null check (weekday between 0 and 6),
  start_min      int not null check (start_min between 0 and 1440),
  end_min        int not null check (end_min between 0 and 1440),
  effective_from date,
  effective_to   date,
  check (end_min > start_min)
);

create table partner_exceptions (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('block','extra')),
  start_min  int,
  end_min    int,
  reason     text
);

create table partner_invites (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  email      text not null,
  phone      text,
  area       text,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table partner_applications (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null,
  pitch      text,
  linkedin   text,
  status     text not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- sessões ----------
create table bookings (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references orgs(id),
  partner_id            uuid not null references partners(id),
  professional_id       uuid not null references profiles(id),
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  duration_min          int not null default 30,
  extended_by           int not null default 0,
  price_fichas          int not null default 1,
  status                booking_status not null default 'pending',
  attended_partner      boolean,
  attended_professional boolean,
  room_name             text,
  created_via           text not null default 'search',
  briefing_id           uuid,
  confirmed_at          timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          uuid,
  created_at            timestamptz not null default now(),
  check (end_at > start_at),
  -- invariante 7: o banco impede sobreposição, inclusive de sessão estendida
  constraint bookings_no_overlap exclude using gist (
    partner_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status in ('pending','confirmed'))
);

create index on bookings (professional_id, start_at);
create index on bookings (org_id, start_at);
```

Demais tabelas, mesmas convenções (`id uuid pk`, `created_at timestamptz`, FK com `references`),
criadas na Etapa 3: `briefings`, `session_events`, `reviews`, `gift_quotas`, `partner_hours`,
`goals`, `checkins`, `notifications`, `waitlist`, `async_questions`, `suggestion_events`,
`org_usage`, `reports`, `moderation_queue`, `app_config`, `audit_logs`.

### Triggers obrigatórios

```sql
-- saldo mantido pelo banco; o check (balance >= 0) derruba a transação no débito indevido
create or replace function apply_wallet_entry() returns trigger language plpgsql as $$
begin
  update wallets
     set balance = balance + new.amount, last_entry_at = now()
   where user_id = new.user_id
  returning balance into new.balance_after;
  if not found then raise exception 'carteira inexistente: %', new.user_id; end if;
  return new;
end $$;

create trigger trg_wallet_entry before insert on wallet_ledger
  for each row execute function apply_wallet_entry();

-- livro-caixa é imutável
create or replace function block_mutation() returns trigger language plpgsql as $$
begin raise exception 'livro-caixa é imutável'; end $$;

create trigger trg_wallet_ledger_immutable before update or delete on wallet_ledger
  for each row execute function block_mutation();
```

Espelhar ambos para `org_ledger` / `org_wallets`.

### RLS

```sql
create or replace function auth_role() returns user_role language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role','')::user_role
$$;

create or replace function auth_org_id() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
$$;
```

RLS habilitado em **todas** as tabelas. Princípios das policies:

- `partners`, `partner_rules`, `partner_exceptions`: `select` para qualquer autenticado quando
  `status = 'active'`; o próprio Parceiro e o `admin` veem qualquer status. `update` só do próprio
  Parceiro, e **nunca** da coluna `status`.
- `profiles`: `select` onde `org_id = auth_org_id()`, mais o próprio registro; `admin` vê tudo.
- `wallets` e `wallet_ledger`: `select` apenas do próprio `user_id`. **Nenhuma** policy de
  `insert`, `update` ou `delete`.
- `bookings`, `briefings`, `reviews`, `session_events`: `select` para o profissional dono ou o
  Parceiro da sessão. **Nenhuma policy para `org_admin`** — invariante 10.
- `org_usage`: `select` para `org_admin` da própria empresa e para `admin`.
- `app_config`: `select` para qualquer autenticado; escrita só `service_role`.
- `audit_logs`, `partner_invites`, `partner_applications`, `moderation_queue`: leitura só `admin`
  ou `moderator`.

`service_role` ignora RLS — é por isso que ele só existe no servidor.

---

## Política da ficha — `app_config.ficha_policy`

| Chave | Default |
|---|---|
| `default_allocation_per_user` | 2 por mês |
| `expires` | **false** — fichas acumulam |
| `max_balance` | 6 |
| `price_30` | 1 |
| `cancel_window_hours` | 12 |
| `partner_no_show_bonus` | 1 |
| `gift_quota_monthly` | 3, não acumula |
| `extension_quota_monthly` | 3, não custa ficha |
| `idle_nudge_after_days` | 21 |

**Limites:** `booking_horizon_days` 14 · `max_pending_per_professional` 2 ·
`pending_expires_hours` 48 · `min_notice_hours` 12 · `session_grace_minutes` 15

### Fluxo da ficha

```
admin registra contrato ──▶ org_ledger purchase  (+N)
RH aloca ────────────────▶ org_ledger allocate (−1) + wallet_ledger allocate (+1)  [1 transação]
profissional agenda ─────▶ wallet_ledger spend (−1) + insert bookings              [1 transação]
cancelou a tempo ────────▶ wallet_ledger refund (+1)
Parceiro presenteia ─────▶ wallet_ledger gift (+1) + debita gift_quotas
colaborador sai ─────────▶ wallet_ledger reclaim (−saldo) + org_ledger reclaim (+saldo)
```

### Máquina de estados

```
pending ──confirmar──▶ confirmed ──fim + 15min──▶ done
   │                       │
   │ 48h sem resposta      ├──cancelar──▶ cancelled (estorno se > cancel_window_hours)
   ▼                       ├──ninguém ou só Parceiro entrou──▶ no_show_professional (ficha some)
 expired (estorno)         └──só profissional entrou──▶ no_show_partner (estorno + bônus)
```

### Indicador que sustenta a renovação

**Taxa de utilização** = fichas usadas ÷ alocadas, por empresa e mês. Empresa que paga e não usa não
renova, então subutilização é problema de produto. Em Postgres é uma view sobre `wallet_ledger` —
não precisa de cron de pré-agregação, só de materialização se ficar lenta.

### Trabalho agendado (Vercel Cron, idempotentes)

`allocate-monthly` (dia 1º) · `expire-pending` (horário) · `close-sessions` (15 min) ·
`send-reminders` 24h e 1h (15 min) · `nudge-idle` (semanal) · `aggregate-demand` (semanal) ·
`checkin-7d` (diário) · `refund-unanswered` (diário)

### Vídeo

Sala Daily criada sob demanda no primeiro `join`, nome = `booking_id`. Token por participante com
`nbf` = início − 10 min, `exp` = fim + 15 min. Estender prorroga `exp` e `end_at`, e só é permitido
se `canExtend` for verdadeiro. Webhook grava `session_events`. Gravação desligada por padrão.

### LGPD

Controladora é a empresa da operadora. Termos e política de privacidade são fornecidos por ela e
apenas inseridos em `app_config.copy.legal`. Exclusão de conta marca `deleted_at` e anonimiza nome,
foto, e-mail e telefone; livros-caixa, `bookings` e `audit_logs` permanecem — são imutáveis.

---

## Roadmap

**Base (Etapas 0–5):** contrato e limpeza · design system e cascas · conexão Supabase/Drizzle ·
esquema, constraints e RLS · auth, papéis e config · motor de agenda.

**Piloto fechado — alvo 10/11/2026.** Tudo operado pelo admin, nada self-service.
- **P1** Painel do admin: criar empresa, registrar contrato, criar Parceiro direto, criar
  Profissional, alocar fichas
- **P2** Disponibilidade do Parceiro (só modo rápido "esta semana") e perfil básico
- **P3** Carteiras, `allocate-monthly`, `POST /api/bookings` transacional
- **P4** Busca simples, agendamento, agenda das duas visões, `expire-pending`, `close-sessions`,
  `send-reminders`
- **P5** Sala Daily, webhook de presença, extensão de 30 min dentro da sala

Fora do piloto: convite por token, candidatura espontânea, console do RH, personalização por
empresa, briefing, avaliação, presente, cancelamento com estorno, moderação.

**Produto (nov/2026 – fev/2027):** F1.5 convite e moderação · F2 console do RH · F3 grade semanal
completa · F4 personalização por empresa · F6 briefing · F7 cancelamento e fila de espera ·
F8 avaliação e presente · F9 horas do Parceiro · F10 resumo por IA e check-in · F11 assistente e
sinal de demanda · F12 pergunta assíncrona · F13 pílulas · F14 trilha · F15 indicação ·
F16 formato grupo · F18 dashboards e exclusão de conta.

---

## Decisões tomadas

- Modelo B2B: RH compra bloco de fichas e distribui. Multi-tenant é o produto.
- **Supabase no lugar de Firebase**, decidido antes de qualquer código: RLS protege o isolamento
  entre empresas concorrentes, constraints garantem o livro-caixa, relatório vira query.
- Parceiros pertencem à plataforma; Profissionais pertencem a uma empresa.
- RH vê utilização agregada, nunca conteúdo nem par profissional↔Parceiro.
- Sessão de 30 minutos apenas no lançamento.
- Fichas acumulam e não expiram; subutilização é combatida por aviso e medida.
- Parceiro escolhe entre presentear ficha **ou** estender a sessão, decidido dentro da sala.
- Parceiro pode ser voluntário, parceria ou remunerado; a plataforma acompanha horas, mas **não
  processa pagamento**.
- Piloto fechado em 10/11 com operação manual; self-service depois.
- Busca no cliente; sem serviço de busca externo.
- **Duas conexões Postgres:** `DATABASE_URL` no pooler de transação (6543, `prepare: false`) para o
  runtime serverless; `DIRECT_URL` na 5432 para DDL — pooler de transação não aceita migração.
- **`drizzle-kit push` não existe no projeto.** Sincroniza sem gerar arquivo e fura a regra de
  migração versionada. Só `db:generate` + `db:migrate`.
- **No Next 16 `middleware.ts` virou `proxy.ts`.** É lá que a sessão do Supabase é renovada — por
  isso `supabase/server.ts` engole o erro de escrita de cookie: Server Component não grava, o
  proxy grava. Exporta função `proxy`, roda sempre em Node e não aceita config de segmento.
- **`auth_role()` devolve `text`, não `user_role`.** As policies são criadas na mesma migração que
  o enum, e o Postgres resolve a função no `create policy` — então ela precisa existir antes do
  tipo. A comparação é idêntica; perde-se só o erro de digitação pego pelo tipo.
- **RLS decide linha; privilégio de coluna decide coluna.** `status` de `partners` e `role`/`org_id`
  de `profiles` são protegidos por `revoke update` + `grant update (colunas)`, não por policy.
- **`org_usage` é view que roda como dona**, ignorando a RLS de `wallet_ledger` de propósito: é o
  que deixa o RH ver o agregado sem nunca ver a linha. O recorte por empresa vive no `where`, via
  `can_read_org()`.
- **A sessão é lida com `getClaims()`, nunca com `getUser()`.** `user_role` e `org_id` são claims
  customizadas escritas pelo hook na emissão do token; o objeto de usuário do servidor de auth não
  as carrega. De quebra, `getClaims()` verifica a assinatura localmente com chave assimétrica.
- **A migração cria o hook; o painel liga.** `custom_access_token_hook` é chamado pelo GoTrue, não
  pela aplicação, e a ativação vive em Authentication → Hooks. Migração aplicada com o gancho
  desligado é esquema montado e inerte: ninguém recebe papel e toda policy nega, sem erro nenhum.
- **Nada é estático: `force-dynamic` no layout raiz.** Ele lê a sessão para resolver marca e
  vocabulário, e toda tela abaixo é de um papel e de uma empresa. Sem isso o build tenta
  pré-renderizar as cascas onde não há cookie nem requisição.
- **Rota casa por segmento, não por string.** `/parceiros` é a busca do Profissional e `/parceiro`
  é a casca do Parceiro: com `startsWith` puro o Profissional cai na casca errada, e como as duas
  telas existem o sintoma não é 404, é papel trocado.
- **`/api` fica fora do matcher do proxy.** Route Handler se protege sozinho; cron da Vercel e
  webhook do Daily chegam com segredo em cabeçalho e sem cookie, e o guarda de sessão só os
  barraria.
- **`terms.ts` não exporta objeto de termos pronto.** Exportar um seria o caminho mais curto para
  um "Parceiro" congelado no bundle. Quem precisa de termos chama `loadTerms()` no servidor ou
  `useTerms()` no cliente; `DEFAULT_TERMS` é fallback de banco fora do ar, não vocabulário.
- **Nome da plataforma é marca, não vocabulário.** Saiu de `copy.terms` e passou a viver em
  `branding`, junto de accent e logotipo — o mesmo lugar que a empresa sobrescreve.
- **Configuração degrada para o default; dado falha alto.** `app_config` fora do ar devolve os
  defaults e a tela sobe. Saldo, agenda e sessão não têm esse direito.

## Descartado

- Firebase / Firestore. - Chat livre fora da janela de 24h da sessão. - Ranking público.
- Gravação por padrão. - Marketplace de cursos. - Pagamento dentro da plataforma.

## Em aberto

- Nome da plataforma, domínio e identidade visual.
- O RH escolhe quais Parceiros sua empresa enxerga, ou todos veem todos?
- Parceiro pode recusar atender determinada empresa?
- Profissional que sai da empresa: `reclaim` automático ou manual?
- Parceiro ganha ficha por hora doada? (`flags.partner_earns_fichas`, default false)

---

## Estado atual

Etapa: **4** — auth, papéis e config. Cinco migrações versionadas em `mentoria-dev`: prólogo,
esquema base, epílogo, `auth_claims` (o `custom_access_token_hook`, invariante 19) e
`copy_e_branding` (`app_config` ganhou as chaves `copy` e `branding`).

Entrada por e-mail e senha em Server Action, `proxy.ts` renovando a sessão e mandando cada papel
para a sua casca, `requireRole()` repetindo a regra dentro de cada layout, e `app_config`
alimentando vocabulário e marca — com sobrescrita por empresa via `orgs.branding`.

89 testes em 7 arquivos. Invariante 19 coberta das duas pontas
(`src/lib/auth/hook.test.ts`, 12 casos contra o Postgres de verdade): o hook escreve as claims, e
`auth_role()` / `auth_org_id()` leem exatamente o que ele escreveu. Invariantes 3, 4, 7, 8, 9, 10
e 16 seguem em `src/lib/db/invariantes.test.ts`. Invariante 5 travada por `server-only` mais teste
estático, agora cobrindo também `lib/auth/session.ts` e `lib/config/load.ts`.

**Pendência que bloqueia o login:** o hook está no banco e testado, mas **desligado no painel**.
Sem ativar em Authentication → Hooks → Customize Access Token, o token sai sem `user_role` e todo
mundo cai em "acesso inativo". Verificado end-to-end em 18/09/2026.

Próxima: Etapa 5 (motor de agenda). Motor de agenda: **não travado**.
