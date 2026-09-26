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
Vercel (`gru1`) · Vercel Cron · Luxon · Vitest · Daily.co · Claude API · Z-API · Resend ·
**lucide-react** (ícones, só por `components/ui/icones.ts`).
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

**Base (Etapas 0–5):** ✅ contrato e limpeza · design system e cascas · conexão Supabase/Drizzle ·
esquema, constraints e RLS · auth, papéis e config · motor de agenda.

**Piloto fechado — alvo 10/11/2026.** Tudo operado pelo admin, nada self-service.
- **P1** ✅ Painel do admin: criar empresa, registrar contrato, criar Parceiro direto, criar
  Profissional, alocar fichas
- **P2** ✅ Disponibilidade do Parceiro (só modo rápido "esta semana") e perfil básico
- **Polimento** ✅ Ícones, vocabulário humano no lugar de código de banco, edição de Parceiro e
  Profissional, status, acesso e senha provisória pelo admin, busca nas listas, menu no celular
- **P3** ✅ Carteiras, `allocate-monthly`, `POST /api/bookings` transacional
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
- **Escrita privilegiada por Server Action, com a transação num módulo à parte.** A invariante 4
  diz que o cliente não escreve nos livros-caixa — e Server Action é servidor, não cliente. O que
  ela proíbe continua proibido: não há policy de `insert` para papel autenticado. A transação em si
  mora em `lib/ledger`, não na ação, porque a alocação mensal do cron (P3) e a alocação manual do
  admin **têm** de ser a mesma escrita; Route Handler e Server Action passam a ser só duas portas
  para a mesma função.
- **A operação transacional é separada de quem abre a conexão.** `ledger/operacoes.ts` e
  `pessoas/operacoes.ts` recebem a transação e não têm `server-only`; `ledger/index.ts` e
  `pessoas/criar.ts` abrem a transação e têm. É isso que deixa o teste chamar a **mesma** função que
  a aplicação chama e desfazer tudo por `rollback` — que não é `delete` e por isso passa pelo
  trigger de imutabilidade. Teste que reescrevesse o SQL provaria que o banco funciona, não que a
  aplicação usa o banco certo.
- **A ação manual do admin tem chave de idempotência própria.** O cron usa
  `alloc_{userId}_{YYYYMM}`; a mão humana usa `allocmanual_{userId}_{token}`, com o token sorteado
  quando o formulário é montado. Se as duas colidissem, a primeira alocação manual do mês faria o
  cron daquele mês achar que já rodou — e o colaborador ficaria sem ficha sem erro nenhum aparecer.
  Reenviar o formulário colide (é o que se quer); reabrir a tela sorteia outro token.
- **Identidade e perfil não cabem numa transação.** `auth.users` é chamada HTTP ao servidor de auth
  e `profiles` é SQL. A ordem é criar a identidade primeiro e apagá-la se o SQL falhar: o inverso
  deixaria perfil sem login, invisível até alguém tentar entrar. O `id` é sorteado pela aplicação
  para a compensação saber o que apagar mesmo se a resposta se perder.
- **Senha provisória mostrada uma vez, até o convite existir.** Sem Resend não há convite por link,
  e deixar o admin inventar a senha produziria "mentoria123" em todas as contas. O alfabeto exclui
  caractere ambíguo porque essa senha vai ser ditada por telefone.
- **Carteira é criada junto da empresa e da pessoa, não por trigger.** O trigger de saldo só sabe
  somar: `apply_org_entry` e `apply_wallet_entry` levantam exceção quando a carteira não existe. Sem
  a linha no mesmo `insert`, a primeira compra falharia com "carteira inexistente" — erro certo,
  momento errado.
- **`max_balance` é conferido em código, com `for update`.** O teto por carteira vive em
  `app_config` e muda por empresa, então o banco não tem como saber o número. Travar a linha antes
  de ler é o que impede duas alocações simultâneas de passarem do teto juntas. O que **não** é
  conferido em código é o saldo: quem recusa o débito indevido é o `check (balance >= 0)`, porque
  checagem prévia perde a corrida com o segundo clique e constraint não perde.
- **Parceiro criado pelo admin nasce `active`, não `invited`.** No piloto não há onboarding para ele
  percorrer — quem preenche o formulário já falou com a pessoa. A invariante 8 continua de pé:
  `status` só muda por `service_role`, e `approved_by` registra quem decidiu.
- **A P1 veio antes da Etapa 5.** O motor de agenda é TypeScript puro e não produz tela; o painel do
  admin não depende dele e é o que semeia o dado de que toda tela posterior precisa. Ordem do
  roadmap trocada de propósito, uma vez.
- **Nunca duas consultas Drizzle em paralelo na conexão de runtime.** O pooler de transação roda
  com `max: 1`, e um `Promise.all` de duas consultas Drizzle sobre uma conexão **já usada** entala a
  conexão para sempre — não é lentidão, é `state = active` em `pg_stat_activity` esperando o cliente
  para sempre. E como a conexão vive no `globalThis`, o processo inteiro para junto: toda requisição
  seguinte fica na fila atrás dela, inclusive as que nem tocam no banco. O sintoma engana, porque a
  tela que trava não é a que tem o defeito. Serializar não custa nada: numa conexão só as consultas
  já seriam sequenciais. Medido com `execute` e com o construtor, com `prepare` ligado e desligado.
  Cuidado com o caso indireto — `Promise.all([f(), g()])` é seguro se `g()` esperar a promessa de
  `f()` antes de consultar, que é o que salva o `app/layout.tsx`.
- **Coluna `jsonb` se escreve com `paraJsonb()` e `::text::jsonb`, nunca com `tx.json()`.** As duas
  alternativas óbvias falham, cada uma em um ambiente: `tx.json()` é o que a documentação do
  postgres.js manda usar, passa em todo teste, e **estoura dentro do bundle do Next** com
  `ERR_INVALID_ARG_TYPE`; `${JSON.stringify(x)}::jsonb` grava a string JSON *como* valor jsonb, sem
  erro nenhum, e só aparece quando alguém lê `branding->>'accent'` e recebe nada. O `::text` no meio
  tira a inferência de tipo do driver e dá o mesmo resultado nos três ambientes. A tabela da medição
  está em `src/lib/db/jsonb.ts`.
- **O que os testes não alcançam vira varredura de código.** Vitest roda em Node contra `DIRECT_URL`
  (5432, `prepare` ligado); a aplicação roda no bundle do Next contra `DATABASE_URL` (6543, sem
  `prepare`). São três ambientes e o teste só visita um. Quando o modo de falha vive fora do
  alcance do Vitest — como o `tx.json()` — o que impede a volta é teste estático sobre o
  código-fonte, na mesma linha do que já guarda a invariante 5 e o vocabulário.
- **A grade do motor é de 30 em 30 minutos; o descanso é conferido contra o que já está marcado.**
  A alternativa — espaçar os candidatos por duração mais buffer — produziria horários fixos de 45 em
  45 e desperdiçaria a agenda. Do jeito escolhido, a faixa das 9h às 12h oferece seis horários, e é
  a reserva de um deles que apaga os vizinhos. O passo é parâmetro, e o default é a duração.
- **A semana do teto vai de domingo a sábado.** `partner_rules.weekday` usa 0 para domingo, que é a
  convenção do `dow` do Postgres e do calendário brasileiro. Contar `max_per_week` numa fronteira e
  escrever a regra em outra faria "4 sessões por semana" significar duas coisas diferentes na mesma
  tela. A ISO, que começa na segunda, ficou de fora por isso.
- **Hora que não existiu no relógio local não vira horário.** Na virada do horário de verão para a
  frente o relógio salta, e Luxon, pedido um horário do buraco, empurra para o instante seguinte em
  vez de recusar — o motor ofereceria 0h30 e a tela mostraria 1h30. `instanteLocal` confere se o
  relógio devolvido bate com o que se pediu. O Brasil não tem horário de verão desde 2019; o campo é
  IANA e o motor fica travado, então o custo de acertar agora é zero e o de errar é uma sessão
  perdida quando o primeiro Parceiro de fora entrar.
- **O motor devolve o motivo da recusa, não só a lista.** `avaliarSlots` marca cada candidato com
  `ocupado`, `descanso`, `teto-semanal`, `fora-do-aviso-minimo` ou `fora-do-horizonte`. É o que
  permite a tela do Parceiro responder "por que não tem horário?" com uma frase em vez de um vazio —
  e é o que deixa o teste afirmar a causa, e não a ausência.
- **O Parceiro escreve pela RLS, com o cliente da sessão dele.** É o único lugar do produto em que o
  papel autenticado escreve: a Etapa 3 deu a ele policy de `all` nas próprias regras e privilégio de
  coluna no próprio perfil. Usar `service_role` aqui funcionaria e desperdiçaria o desenho — do jeito
  que está, policy errada quebra a tela na hora, em vez de só aparecer quando alguém ler o que não
  devia. E o `partner_id` nunca é parâmetro: vem do JWT.
- **Parceiro mexendo em si não grava `audit_logs`.** A invariante 12 pede registro de ação de admin,
  moderador e RH — ação sobre terceiro. Ajustar a própria agenda não é. A exceção é a invariante 18,
  correção de presença, que chega na P5.
- **O modo rápido substitui a rotina inteira, não acrescenta.** É o que "modo rápido" significa: o
  Parceiro está descrevendo a semana dele, não somando uma linha. Quando a grade detalhada da F3
  chegar, esta tela precisa avisar antes de sobrescrever o que a outra montou.
- **Ícone atravessa a fronteira por nome, não por componente.** A `Sidebar` é Server Component e
  entrega a navegação a `NavLinks`, que é cliente — e componente não é serializável. `NavItem` leva
  `icone: NomeIcone` e o mapa nome → lucide mora em `components/ui/icones.ts`. O mapa é também o
  catálogo: o que não está nele não entra na interface.
- **Código de banco não chega à tela.** `audit_logs.action` continua sendo um código estável
  (`alocar_fichas`), mas cada código tem frase em `lib/admin/atividade.ts`, escrita com os termos da
  empresa. `registrarAuditoria` só aceita `AcaoAuditada`, derivado desse catálogo: ação nova sem frase
  não compila. O que vem do banco sem rótulo sai humanizado, nunca cru, e `lib/copy.test.ts` varre o
  JSX atrás de `snake_case` e nome de tabela escritos à mão. O mesmo vale para `ledger_type`, que é
  inglês: `lib/ledger/rotulos.ts` é tipado pelo próprio enum do esquema.
- **Edição audita a diferença, não o registro.** `before` e `after` guardam só os campos que
  mudaram, e salvar sem mudar nada não grava linha. Um histórico de perfis inteiros dos dois lados
  obrigaria quem lê a achar a diferença no olho.
- **Pausar esconde; arquivar esconde e tira o acesso.** Pausado continua entrando e as sessões
  marcadas seguem — é o que se faz antes de férias. Arquivar derruba `profiles.active` na mesma
  transação e é recusado com sessão futura, assim como desativar Profissional. O acesso do Parceiro
  acompanha o status; só o Profissional tem chave de acesso própria, para não haver duas chaves na
  mesma porta discordando.
- **E-mail repetido na troca é conferido antes, em `auth.users`.** Na criação o servidor de auth
  responde "already registered"; na troca responde `500 Error updating user`, sem código — medido
  contra o `mentoria-dev`. Reconhecer pelo erro, como a criação faz, produzia mensagem genérica.
- **Senha nova é trocada e depois auditada; se a auditoria falhar, não é mostrada.** Senha que
  ninguém viu não é acesso concedido. Auditar antes gravaria uma troca que pode não ter acontecido.
  E nunca se abre transação em volta da chamada HTTP ao auth: a conexão de runtime é `max: 1`.
- **Formulário de edição envia por `onSubmit`, não por `action`.** O React 19 reseta os campos não
  controlados quando a ação termina, e devolver erro de validação conta como terminar. Em edição
  isso apagava o que a pessoa digitou justo quando o servidor recusou. `useEnvioSemReset` resolve.
- **Nenhum número de mentira em tela de dinheiro.** Os três números fixos da Etapa 1 saíram da
  sidebar do admin, e não foram trocados pelos reais: a sidebar renderiza em paralelo com a página, e
  uma consulta Drizzle ali é o `Promise.all` que entala a conexão. Os reais estão no painel.
- **Carregando é forma parada, não movimento.** `loading.tsx` mostra blocos estáticos; nada de
  spinner nem `animate-pulse`. O sistema de design reserva animação para presente e extensão.
- **Instante vai por `paraInstante()` com `::text::timestamptz`, nunca como `Date`.** Segunda
  armadilha da mesma família do `tx.json()`, achada do mesmo jeito — rodando. Interpolar um `Date`
  no template do postgres.js funciona em Node puro, passa em toda a suíte, e **estoura dentro do
  bundle do Next** com `ERR_INVALID_ARG_TYPE: Received an instance of Date`. A tabela da medição
  está em `src/lib/db/instantes.ts`. A lição maior: quando o teste roda num ambiente e a aplicação
  em outro, "os testes passam" não é notícia sobre a aplicação.
- **A reserva recalcula a agenda antes de escrever.** O instante que chega do cliente é palpite: o
  motor roda de novo dentro da transação e o horário tem de estar entre os livres. Sem isso a
  validação inteira — descanso, teto semanal, aviso mínimo, férias — viraria enfeite de tela,
  contornável por um `curl`. É a invariante 14 aplicada na escrita.
- **A reserva roda privilegiada, e tem de rodar.** Não dá para reusar `lib/parceiro/dados.ts`: a
  policy de `bookings` não deixa um Profissional ver sessão de terceiro, o que é correto. Quem
  agenda precisa saber que o horário está ocupado sem poder saber por quem — e isso só acontece do
  lado do servidor.
- **A carteira é travada antes de tudo na reserva.** Dois efeitos, os dois necessários: ler o saldo
  sem corrida, e serializar todas as reservas daquele Profissional. Sem o segundo, dois pedidos
  simultâneos dele passariam os dois pela contagem de pendentes e o
  `max_pending_per_professional` valeria como sugestão.
- **A alocação recebe a chave de idempotência pronta, não o token.** `alocacaoNaTransacao` não monta
  mais a chave: quem chama monta. É o que garante que `alloc_{user}_{YYYYMM}` (cron) e
  `allocmanual_{user}_{token}` (admin) não possam se tornar a mesma coisa por um refator distraído.
- **A recarga mensal é uma transação por pessoa.** Carteira no teto, contrato que acabou no meio da
  lista ou dado corrompido de uma empresa não podem impedir as outras de receber. Em troca a rodada
  pode parar no meio — e isso é seguro justamente por causa da chave: a próxima execução retoma,
  porque quem já recebeu colide e quem não recebeu passa.
- **A recarga soma o valor do mês, parcialmente se não couber.** Saldo 5 com teto 6 recebe 1, não
  zero: fichas acumulam e o teto não é motivo para deixar ficha na mesa. Quem está no teto é pulado
  antes de abrir transação — mais barato, e o relatório distingue "já recebeu" de "carteira cheia".
- **Cron sem segredo responde 503, não 401.** Não é credencial errada, é servidor sem condição de
  rodar trabalho agendado. De fora os dois são indistinguíveis; no log e no painel da Vercel dizem
  coisas diferentes, e isso decide se alguém vai procurar a variável ou o segredo.
- **Auditoria aceita autor nulo.** Cron não tem pessoa por trás, e inventar um usuário de sistema
  faria o histórico afirmar algo falso. As colunas já eram anuláveis e o feed já escrevia "Trabalho
  agendado" — só o tipo precisava deixar.
- **A carteira do Profissional é lida pela sessão dele, por PostgREST.** `wallets` e `wallet_ledger`
  têm policy de `select` do próprio `user_id` e nenhuma de escrita: ler por ali é ler exatamente o
  que a policy permite, e policy frouxa apareceria na hora. De quebra o saldo pode ser lido no
  layout sem entalar a conexão Drizzle de `max: 1`.
- **O extrato não mostra quem lançou.** Quem aloca é a operadora ou o RH, e a policy de `profiles`
  não deixa o Profissional ler perfil de fora da empresa dele (invariante 9). Tentar mostrar o nome
  daria coluna vazia e cara de defeito. O que importa ali é o movimento da ficha.
- **O cenário dos testes de banco mora em `src/lib/db/cenario-de-teste.ts`.** Três suítes montam a
  mesma empresa, o mesmo Profissional com carteira e o mesmo Parceiro com rotina; a terceira cópia
  dos seeds seria a terceira chance de divergirem sem ninguém notar. A cerca é
  `cenario-de-teste.test.ts`, que recusa importação fora de teste e `insert into auth.users` em
  qualquer outro lugar.
- **Falta de variável de ambiente degrada; não derruba a aplicação inteira.** A decisão da Etapa 4
  dizia que o proxy fecha e "a tela de entrada continua de pé" — e ela nunca ficou: o layout raiz lê
  a sessão em toda requisição, `createClient()` estourava, e o resultado era 500 opaco em **todas**
  as rotas, inclusive `/entrar`. Descoberto no primeiro deploy de verdade, em 26/09/2026.
  `getSession()` agora devolve `null` quando o Supabase não está configurado — sem auth não há
  sessão, e isso é a verdade e não uma falha —, e `/entrar` nomeia as variáveis que faltam. É a
  regra de sempre aplicada à configuração: config degrada, dado falha alto.
- **`NEXT_PUBLIC_*` é embutida em tempo de build.** Cadastrar a variável no painel da Vercel e não
  redeployar deixa o bundle antigo com string vazia — a tela continua quebrada e parece que a
  variável não pegou. Vale para qualquer ambiente, e é a primeira coisa a conferir quando o valor
  "não chegou".

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

Fase: **P3 fechada**. Base completa (Etapas 0–5) e três fases do piloto no ar.

A economia da plataforma anda sozinha de ponta a ponta. A operadora compra o bloco e aloca à mão; o
cron `allocate-monthly` recarrega no dia 1º somando o valor do mês até o teto, idempotente por
`alloc_{userId}_{YYYYMM}`; e `POST /api/bookings` transforma ficha em sessão numa transação só —
recalculando a agenda no motor antes de escrever, travando a carteira para serializar as reservas
daquele Profissional, e deixando a sobreposição para a constraint do banco decidir.

O Profissional finalmente vê o próprio dinheiro em `/fichas`: saldo, extrato do `wallet_ledger` com
rótulo em português, e o que a ficha vale. A sidebar dele mostra o saldo real — os números de
exemplo da Etapa 1 saíram de todas as cascas, sem serem trocados por falsos onde a fase ainda não
chegou.

O **motor de agenda** (`src/lib/scheduling/`) segue travado, e agora tem dois consumidores: a tela
de disponibilidade do Parceiro e a reserva. Os limites de `app_config` chegam aos dois pela mesma
função, `limitesDoMotor`.

404 testes em 24 arquivos. Os 44 novos cobrem a reserva contra o Postgres de verdade (gasto que não
sobrevive a booking que falha, horário fora da grade, aviso mínimo, descanso, ocupado, teto de
pendentes, carteira de outra empresa, acesso desativado, Parceiro pausado), a recarga mensal
(parcial, teto, contrato que acaba no meio, segunda execução que não duplica, auditoria sem autor) e
a tradução dos limites. Invariante 19 em `src/lib/auth/hook.test.ts`; invariantes 3, 4, 7, 8, 9, 10 e
16 em `src/lib/db/invariantes.test.ts`; as transações em `ledger/transacoes.test.ts`,
`bookings/reserva.test.ts` e `ledger/mensal.test.ts`, todas chamando as funções que a aplicação
chama. Invariante 5 travada por `server-only` mais teste estático.

Os três caminhos foram percorridos com sessão real: painel da operadora, telas do Parceiro, e agora
`/fichas` mais os dois endpoints — reserva criando sessão confirmada e descontando ficha, e a recarga
mensal reportando `jaFeitas` na segunda execução sem duplicar lançamento.

Próxima: **P4** — busca simples, agendamento, agenda das duas visões, `expire-pending`,
`close-sessions`, `send-reminders`. `POST /api/bookings` já existe e ainda não tem tela que o chame;
é ela que a P4 traz. Motor de agenda: **travado**.
