# App de Mentoria — Contexto do Projeto

## O que é

Plataforma de mentoria com **dois canais de entrada** (diretriz de 01/10/2026):

- **Empresa (B2B).** Vendida para RHs. A empresa contratante compra um bloco de **fichas** e o RH
  distribui entre colaboradores selecionados.
- **Profissional avulso (pessoa física).** Quem busca mentoria por conta própria, sem empresa por
  trás, tem conta própria e obtém as próprias fichas.

Cada ficha vale uma sessão 1:1 de 30 minutos, por vídeo, dentro da plataforma.

Os **Parceiros de Desenvolvimento** são curados e convidados pela operadora da plataforma e atendem
profissionais de todas as empresas contratantes e os avulsos — todos eles, inclusive os
voluntários. Uma **conta de Profissional** pertence a uma empresa ou é pessoal; uma mesma pessoa
pode ter as duas, como dois logins com dois e-mails.

Nicho provável: educação superior e saúde. Web responsiva, pt-BR. Não é app nativo de loja.

### Vocabulário — em toda a interface, sem exceção

| Conceito | Termo | Forma curta |
|---|---|---|
| Mentor | Parceiro de Desenvolvimento | **Parceiro** |
| Mentorado | Profissional | Profissional |
| Moeda | ficha / fichas | ficha |

Tratamento **você**. Tom profissional e próximo. Todos os termos vivem em `app_config.copy.terms`,
lidos por `src/lib/terms.ts`, e são sobrescrevíveis por empresa. Nenhum termo de domínio hardcoded.

### Profissional avulso (diretriz de 01/10/2026, plano aprovado no mesmo dia)

**Conta individual é "empresa de um só".** `orgs.kind` (`empresa` | `individual`); cada avulso
aprovado ganha uma `org` própria, com `org_wallet`, ele como único membro (`role = 'professional'`)
e nenhum `org_admin`. Assim `profiles_org_scope` e os `org_id not null` de `wallets`,
`wallet_ledger` e `bookings` continuam valendo, o hook continua emitindo `org_id`, e a RLS por
`auth_org_id()` isola o avulso sem caso especial. Reserva, cancelamento, presente, estorno e
fechamento não mudam. Descartados na análise: `org_id` nulo (o isolamento passaria a depender de
lembrar do caso nulo) e uma `org` "Avulsos" compartilhada (a policy de `profiles` abriria todo
avulso a todos os outros).

- **Cadastro self-service, aprovado pela operadora.** O avulso se cadastra em `/cadastro` com a
  própria senha e confirma o e-mail; o pedido entra em `individual_signups` e só vira conta quando
  o admin aprova em `/admin/cadastros` — lista com seleção e aprovação em lote, uma transação por
  pessoa. Enquanto pendente não há perfil, logo não há `user_role` no token.
- **Paga dentro da plataforma, pelo Asaas** (Pix e cartão, fatura hospedada, NFS-e automática).
  Dado de cartão nunca passa por aqui. A ficha só nasce de pagamento **relido na API do Asaas** —
  pelo webhook, pela página de retorno ou pelo cron de conciliação, as três chamando a mesma
  função —, como `purchase` + `allocate` na conta individual, numa transação, chave `pay_{id}`.
- **Pacotes próprios**, em `app_config.individual_packages`: *Primeira conversa* 1 ficha R$ 129 ·
  *Ritmo* 4 fichas R$ 449 (até 2×) · *Jornada* 8 fichas R$ 799 (até 3×). O pagamento congela o preço.
  A compra ignora `max_balance`.
- **Ficha comprada vale 12 meses.** Cada compra é um lote (`ficha_lots`); o que resta dele é
  derivado do livro-caixa (`wallet_ledger.lot_id`), não guardado. O gasto consome o lote que vence
  primeiro; o estorno volta ao mesmo lote, ou sem validade se ele já venceu; `expire-fichas` dá baixa
  com `expire_{lotId}` e avisa 30 dias antes. Presente e compensação não vencem. Ficha de empresa
  não muda: continua sem validade.
- **Arrependimento em 7 dias (CDC art. 49)**, lote sem ficha usada: reembolso no Asaas primeiro,
  depois `reclaim` na carteira e `refund` no contrato, chave `payrefund_{id}`, auditado.
- **Duas contas, uma por e-mail.** Corporativa e pessoal são logins separados; CPF único entre
  contas pessoais. O RH nunca alcança a conta pessoal.
- **Fora da média das empresas.** `allocate-monthly` pula conta individual; `org_usage`, a taxa de
  utilização e as listas de empresas consideram só `kind = 'empresa'`; `partner_professionals`
  não mostra empresa para o avulso. Vocabulário e marca são os defaults da plataforma.
- **Relação de consumo.** Termos e política da operadora cobrem os dois canais: arrependimento,
  validade de 12 meses, transferência internacional dos metadados do Daily.

Plano completo, com a ordem das entregas: "Roadmap", abaixo.

## Stack

Next.js 16.3.4 (App Router) · TypeScript strict · Tailwind · shadcn/ui ·
**Supabase Postgres (São Paulo) com RLS** · **Drizzle** (schema + migrations + queries tipadas) ·
Supabase Auth (`role` e `org_id` como claims no JWT) · Supabase Storage ·
Vercel (`gru1`) · Vercel Cron · Luxon · Vitest · Daily.co · Claude API · Z-API · Resend ·
**Asaas** (pagamento do avulso, REST por `fetch`, sem SDK) ·
**lucide-react** (ícones, só por `components/ui/icones.ts`).
Dev: `drizzle-kit` (gera migração), `dotenv` (só o `drizzle.config.ts` — o Next lê `.env.local` sozinho).

**Deploy:** projeto `mentoria` na Vercel (plano Pro, org `tostess' projects`), conectado ao
repositório `github.com/tostess/mentoria` e publicando a `main`. Domínio provisório
`mentoria-bay.vercel.app` — o definitivo depende do nome da plataforma, que está em aberto.
Seis variáveis de ambiente, uma delas nova na P3: `CRON_SECRET`, que a Vercel manda sozinha como
`Authorization: Bearer` para as rotas de `/api/cron/*`. As seis estão cadastradas nos três
ambientes desde 27/09/2026 — Production com o `mentoria`, Preview e Development com o
`mentoria-dev` — e os segredos de Production e Preview são *sensitive*: não saem da Vercel.
A pasta está ligada ao projeto por `vercel link` (`.vercel/`, ignorada pelo git).

Mais duas, do spike do vídeo (27/09/2026): `DAILY_API_KEY` (REST do Daily, domínio `tostes`) em
Preview e Development e, **provisoriamente, também em Production** (desde 27/09, *sensitive*), e
`DAILY_WEBHOOK_SECRET` (HMAC do webhook, base64 sorteado aqui) só em Preview e Development.
Invariante 5: só servidor, sem `NEXT_PUBLIC_`; Preview e Production *sensitive*. A chave é lida por
`requireDailyApiKey()` em `lib/env.server.ts`; o segredo do webhook não tem leitor enquanto a
presença vier de `/meetings`. A produção usa o domínio de teste até o domínio próprio existir, que
depende do nome da plataforma — ver "Um domínio Daily por ambiente". Sem chave a sala responde 503
e o `close-sessions` volta à regra da P4. A conta Daily tem cartão cadastrado — sem ele nenhuma chamada
abre.

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
   sobre `(partner_id, tstzrange(start_at, end_at))` para status ativos.
8. **Parceiro nunca se autocadastra.** Só via `partner_invites`. Candidatura espontânea entra em
   `partner_applications` e só vira Parceiro por decisão do admin.
9. **Escopo é assimétrico e isso é intencional:** `partners` pertencem à **plataforma** e são
   visíveis a todas as empresas; `profiles`, `wallets`, `bookings`, `briefings`, `reviews`, `goals`
   são **da conta** — empresa ou individual (que é uma `org` de um só). O isolamento é garantido
   por RLS, não por lembrar de filtrar.
10. **O RH nunca vê conteúdo de sessão.** `org_admin` não tem policy de leitura em `bookings`,
    `briefings`, `reviews` nem `session_events`. Vê apenas `org_usage`. Sem essa garantia ninguém
    usa a plataforma com sinceridade — é argumento de venda, não limitação.
11. **Sala não abre sem briefing** (a partir da fase em que existir).
12. **Toda ação de admin, moderador ou RH grava `audit_logs`.**
13. **Profissional de empresa não compra ficha; o avulso compra pacote.** A ficha comprada só nasce
    de pagamento confirmado **relido na API do gateway** — nunca do corpo do webhook. Nenhuma ficha
    é transferível entre pessoas, nem entre as duas contas da mesma pessoa.
14. **O assistente recomenda pessoas, nunca horários.** Considera todos os Parceiros ativos, com ou
    sem vaga. Todo horário exibido vem do motor.
15. **Sinal de demanda é agregado e anônimo.** Nunca quem, nunca de qual empresa.
16. **Trabalho agendado é idempotente**, via `idempotency_key` única
    (`alloc_{userId}_{YYYYMM}`, `reminder24_{bookingId}`, `nudge_{userId}_{YYYYWW}`).
17. **Production → `mentoria`; Preview e Development → `mentoria-dev`.**
18. **Presença é derivada da sala.** O fechamento lê a presença no Daily (`GET /meetings`) e grava
    `session_events` e `attended_*`. O Parceiro só **corrige**, e a correção grava `audit_logs`.
19. **Papel e `org_id` são lidos do JWT no servidor**, nunca de campo de tabela.
20. **Sessão não se estende; o gesto do Parceiro na sala é o presente.** A sala expira em
    `end_at` + 5 min e o Daily encerra a chamada sozinho. Dentro da sala, e só nela, o Parceiro pode
    presentear **1 ficha por sessão**, dentro da cota mensal dele — sem passar pelo contrato da
    empresa e sem respeitar o teto da carteira.
21. **Dado de cartão nunca passa pela plataforma.** O pagamento acontece na fatura hospedada do
    gateway; aqui só chegam o identificador da cobrança e o status.

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

- **Cor é token, nunca hex no componente** (`bg-accent`, `text-stone`, `border-line`) — desde a F4,
  07/10/2026. Os tokens leem as variáveis `--cor-*`; o layout raiz as escreve em `<html style>` com
  `variaveisDoTema(theme)`, a partir da marca da empresa. Hex só em `globals.css` e `lib/theme.ts`;
  `lib/cores.test.ts` recusa o resto. Era "hex inline, nunca CSS variables" até a F4.
- Estados visuais via `className` condicional.
- **Uma feature por sessão.** Atualizar `CLAUDE.md` e `STATUS.md` ao final.
- Commits curtos, imperativo, em português.
- RLS e audit log evoluem **junto** com cada feature.
- Toda mudança em `scheduling/`, livros-caixa ou policies acompanha teste.
- Migração é sempre arquivo versionado em `supabase/migrations/`. Nunca alterar esquema pelo painel.
- **Protótipo é no código.** Tela nova nasce direto na aplicação, com os componentes do sistema de
  design e dado do `mentoria-dev`, e é aprovada rodando (`next dev` ou Preview da branch), com
  captura de tela nos dois tamanhos. Ajuste pedido na aprovação é feito na própria tela. Os
  `docs/prototipo-*.html` das fases anteriores ficam como histórico e não são mais atualizados.
- Rotas que chamam a Claude API exportam `maxDuration`; conferir o teto do plano da Vercel.
- Busca de Parceiros é filtro no cliente sobre a lista de ativos cacheada. Sem serviço externo
  abaixo de 200 Parceiros.
- Sem `any`. Sem dependência nova sem registrar aqui.

---

## Sistema de design

Paleta **default da plataforma** — o produto é white-label. A cliente ainda não tem marca. A
coluna da esquerda é o token do Tailwind; o default mora em `globals.css` e em `DEFAULT_THEME`
(`lib/theme.ts`), que um teste mantém iguais.

| Token | Default | Família |
|---|---|---|
| `ink` | `#2A1B26` | marca |
| `mist` (fundo) | `#FDF8FB` | marca |
| `surface` (card) | `#FFFFFF` | marca |
| `blush` | `#FCEDF4` | marca |
| `accent` | `#C2317A` | marca |
| `deep` | `#8E1E58` | marca |
| `line` / `line2` | `#F3E4EC` / `#EAD6E1` | marca |
| `stone` | `#8E7C86` | marca |
| `stone-dark` · `muted` · `faint` · `pale` · `ghost` | `#6E5F68` · `#B3A3AC` · `#BFAFB8` · `#C6B8C0` · `#D9C3CF` | marca (neutros de apoio) |
| `accent-10` · `accent-12` · `accent-line` · `on-accent` · `on-soft` | calculados do accent | marca (derivados) |
| `gold` · `gold-soft` · `gold-wash` · `gold-line` · `gold-pale` · `gold-text` · `gold-ink` · `gold-deep` | `#C98A2E` · `#FBF1DE` · … | fixa — a ficha |
| `success` · `-soft` · `-line` | `#2E6B52` · `#EAF6F0` · `#CDE6DA` | fixa |
| `danger` · `-soft` · `-line` | `#A63A2E` · `#FBEAE7` · `#F2CFC8` | fixa |
| `off` · `off-soft` · `ink-night` · `night-text` | desligado; sala escura | fixa |

As famílias **marca** mudam por empresa (`variaveisDoTema`); as **fixas** significam a mesma coisa
em todo cliente e não entram na personalização (decisão de 07/10/2026). Na família marca, tudo sai
do accent por `paletaDoAccent` e a empresa pode ajustar cada cor (`branding.cores`) — F4b.

Fontes: **Darker Grotesque** (títulos 600/700), **Instrument Sans** (corpo), **IBM Plex Mono**
(horários, números, rótulos em caixa alta). Raio 14px, botões 10px, chips 8px.

Princípios: muito branco; o accent é estrutura, não decoração; a ficha é a única coisa dourada e
deve parecer ficha, não botão; o presente é o único momento com animação.

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
| `gift_quota_monthly` | 3, não acumula; 1 por sessão |
| `idle_nudge_after_days` | 21 |

**Limites:** `booking_horizon_days` 14 · `max_pending_per_professional` 2 ·
`pending_expires_hours` 48 · `min_notice_hours` 12 · `session_grace_minutes` 15

### Fluxo da ficha

```
admin registra contrato ──▶ org_ledger purchase  (+N)
RH aloca ────────────────▶ org_ledger allocate (−1) + wallet_ledger allocate (+1)  [1 transação]
profissional agenda ─────▶ wallet_ledger spend (−1) + insert bookings              [1 transação]
Profissional cancela ────▶ wallet_ledger refund (+1), se pedido ou > cancel_window_hours
Parceiro cancela ────────▶ wallet_ledger refund (+1) + adjust (+bônus) se < cancel_window_hours
Parceiro presenteia ─────▶ wallet_ledger gift (+1) + gift_quotas (+1)              [1 transação, na sala]
colaborador sai ─────────▶ wallet_ledger reclaim (−saldo) + org_ledger reclaim (+saldo)

avulso paga (relido no Asaas) ▶ org_ledger purchase (+N) + allocate (−N)
                                + wallet_ledger allocate (+N, lot_id) + ficha_lots    [1 transação]
lote vence (12 meses) ───▶ wallet_ledger expire (−restante do lote)
avulso se arrepende (7 d) ▶ reembolso no Asaas, depois wallet_ledger reclaim (−N)
                                + org_ledger reclaim (+N) + org_ledger refund (−N)    [1 transação]
```

Na conta individual o `spend` leva o `lot_id` do lote que vence primeiro, e o `refund` devolve ao
mesmo lote — ou sem lote, se ele já venceu.

### Máquina de estados

```
pending ──confirmar──▶ confirmed ──fim + 15min──▶ done
   │  │                    │
   │  ├──Parceiro recusa──▶ cancelled (estorno imediato)
   │  └──Profissional cancela──▶ cancelled (estorno)
   │ 48h sem resposta      ├──Profissional cancela──▶ cancelled (estorno se > cancel_window_hours)
   │                       ├──Parceiro cancela──▶ cancelled (estorno; + bônus se < cancel_window_hours)
   ▼                       ├──ninguém ou só Parceiro entrou──▶ no_show_professional (ficha some)
 expired (estorno)         └──só profissional entrou──▶ no_show_partner (estorno + bônus)
```

Cancelar só vale até a sala abrir (início − 10 min); a regra inteira é `regraDoCancelamento`, em
`lib/bookings/cancelamento.ts`.

### Indicador que sustenta a renovação

**Taxa de utilização** = fichas usadas ÷ fichas recebidas, por empresa e mês. Usada é gasta menos
estornada (pedido recusado ou expirado não é uso); recebida é alocada mais o que chegou sem sair do
contrato — presente e compensação (gasta, essa ficha não pode empurrar a taxa acima de 100%). Empresa que paga e não usa não renova, então
subutilização é problema de produto. Em Postgres é uma view sobre `wallet_ledger` — não precisa de
cron de pré-agregação, só de materialização se ficar lenta.

### Trabalho agendado (Vercel Cron, idempotentes)

`allocate-monthly` (dia 1º, só empresas) · `expire-pending` (horário) · `close-sessions` (15 min) ·
`reconcile-payments` (horário) · `expire-fichas` e aviso de 30 dias (diário) ·
`send-reminders` 24h e 1h (15 min) · `nudge-idle` (semanal) · `aggregate-demand` (semanal) ·
`checkin-7d` (diário) · `refund-unanswered` (diário) · `anonymize-signups` (diário: login que a
recusa não apagou e pedido recusado há mais de 90 dias)

### Vídeo

Sala Daily criada sob demanda na primeira entrada, nome = `booking_id`, com `nbf` = início − 10 min,
`exp` = fim + 5 min, `eject_at_room_exp` e `max_participants: 2`: o Daily encerra a chamada sozinho,
sem cron. Token emitido **a cada entrada** (recarregar a página pede outro — o Prebuilt apaga o
`?t=` da URL), com os mesmos `nbf` e `exp`, `user_id` = `profiles.id`, `user_name` = primeiro nome,
`is_owner` só para o Parceiro, e **nenhuma** propriedade de expulsão: qualquer uma anularia a da
sala. A sessão não se estende. O fechamento lê `GET /meetings?room=` e grava `session_events`.
Gravação desligada por padrão. Medições em `docs/spike-video.md`.

### LGPD

Controladora é a empresa da operadora. Termos e política de privacidade são fornecidos por ela e
apenas inseridos em `app_config.copy.legal`, e cobrem os dois canais — com o avulso a relação é de
consumo (CDC): arrependimento em 7 dias e validade de 12 meses ditos antes da compra. O CPF do avulso
é pedido só na primeira compra (o gateway e a NFS-e exigem). Pedido de cadastro recusado é
anonimizado em 90 dias. Exclusão de conta marca `deleted_at` e anonimiza nome,
foto, e-mail e telefone; livros-caixa, `bookings` e `audit_logs` permanecem — são imutáveis.

---

## Roadmap

**Base (Etapas 0–5):** ✅ contrato e limpeza · design system e cascas · conexão Supabase/Drizzle ·
esquema, constraints e RLS · auth, papéis e config · motor de agenda.

**Piloto — alvo 30/11/2026** (era 10/11; adiado em 01/10 para incluir o avulso). Operado pelo
admin, com uma exceção self-service: o cadastro do avulso, que a operadora aprova.
- **P1** ✅ Painel do admin: criar empresa, registrar contrato, criar Parceiro direto, criar
  Profissional, alocar fichas
- **P2** ✅ Disponibilidade do Parceiro (só modo rápido "esta semana") e perfil básico
- **Polimento** ✅ Ícones, vocabulário humano no lugar de código de banco, edição de Parceiro e
  Profissional, status, acesso e senha provisória pelo admin, busca nas listas, menu no celular
- **P3** ✅ Carteiras, `allocate-monthly`, `POST /api/bookings` transacional
- **P4** ✅ Busca simples, agendamento, agenda das duas visões com confirmar e recusar,
  `expire-pending`, `close-sessions`
- **P5** ✅ Sala Daily, presença lida da sala, presente de 1 ficha dentro da sala, correção de
  presença — na `main` e em produção desde 27/09; o vídeo em produção depende do domínio Daily próprio
- **Conta** ✅ Menu da conta na sidebar ("Redefinir senha" e "Sair") e aviso de senha provisória
  ao entrar — na `main` e em produção desde 29/09, com a migração `senha_provisoria` no `mentoria`
- **F7 (cancelamento)** ✅ Profissional e Parceiro cancelam a própria sessão até a sala abrir, com
  estorno e compensação pela regra do prazo — na `main` e em produção desde 30/09. Trazida para
  dentro do piloto em 29/09; a fila de espera continua fora
- **F3 (grade semanal e folgas)** ✅ O Parceiro monta a semana com várias faixas por dia e marca
  folga (período, dia inteiro ou faixa) e horário extra numa data — na `main` e em produção desde
  30/09, aprovada no Preview da `f3`. Trazida para dentro do piloto em 30/09
- **A1 (01–09/10) Conta individual** ✅ — na `main` e em produção desde 06/10, com a migração
  `conta_individual` no `mentoria` antes do push. `orgs.kind` e `cpf`, `ledger_type`
  `expire`, `wallet_ledger.lot_id`, `ficha_lots`, `payments`, `individual_signups`, com RLS; claim
  `org_kind` no token. A operadora cria conta pessoal e registra pacote pago fora da plataforma
  (`/admin/contas-pessoais`); o crédito cria o lote de 12 meses; o gasto consome o lote que vence
  primeiro e o estorno devolve a ele. `allocate-monthly` pula; `org_usage`, painel e listas separam;
  `partner_professionals` sem empresa; telas do Profissional com o texto da conta pessoal. **Da
  operadora:** nome da plataforma até 10/10; conta Asaas (sandbox já; produção pede CNPJ, inscrição
  municipal para NFS-e e análise).
- **A2 (13–16/10) E-mail e domínio.** Domínio definitivo, Resend verificado, SMTP do Supabase Auth
  nos dois projetos, `send-reminders` 24h e 1h (a antiga P5+), domínio Daily de produção.
- **A3 (19–23/10) Cadastro e fila** ✅ — na `main` e em produção desde 07/10, adiantada para antes
  da A2 (que espera o nome), com a migração `cadastro_anonimizado` no `mentoria` antes do push e o
  "Esqueceu a senha?" pedido na aprovação.
  `/cadastro` com confirmação de e-mail e `/cadastro/confirmado`; a entrada distingue "confirme o
  e-mail" e "em análise"; `/admin/cadastros` com seleção e aprovação em lote, uma transação por
  pessoa, e recusa que apaga o login; aviso no painel; `anonymize-signups` diário (90 dias).
  **Só abre ao público depois da A2**: o SMTP padrão do Supabase limita e não entrega para fora.
- **A4 (26/10–06/11) Pacotes e pagamento** no Asaas sandbox: compra, CPF, confirmação pelas três
  portas, lotes, extrato, arrependimento, NFS-e configurada.
- **A5 (09–13/11) Validade e vitrine.** `expire-fichas`, aviso de 30 dias, `/pacotes`, termos e
  privacidade dos dois canais.
- **Homologação (16–19/11)** em produção: Asaas de produção, compra real com pacote de teste
  oculto, NFS-e real, ponta a ponta nos dois canais.
- **Congelamento (23–27/11).** Só correção; carga de Parceiros e empresas; treino da operadora.

Sem folga no calendário. Se o nome não sair em 10/10, A2 escorrega e arrasta o resto. Se a conta
Asaas de produção não estiver aprovada até 13/11, o piloto abre com o admin registrando a compra do
avulso à mão (a compra pelo painel já existe) e o checkout entra depois.

- **F4 (07/10, fora do calendário) Marca por empresa** ✅ na branch `f4`, esperando aprovação.
  Trazida para dentro do piloto a pedido, enquanto a A2 espera o nome. F4a: cor virou token. F4b:
  a operadora escolhe cor principal, nome, logotipo e ajuste fino em `/admin/empresas/[id]`, com
  prévia; `/admin/personalizacao` mostra a marca de cada empresa.

Fora do piloto: convite por token de Parceiro, candidatura espontânea, console do RH, briefing,
avaliação, fila de espera, moderação.

**Produto (nov/2026 – fev/2027):** F1.5 convite e moderação · F2 console do RH · F3 grade semanal
completa · F4 personalização por empresa · F6 briefing · F7 cancelamento e fila de espera ·
F8 avaliação · F9 horas do Parceiro · F10 escuta por IA, resumo e check-in · F11 assistente e
sinal de demanda · F12 pergunta assíncrona · F13 pílulas · F14 trilha · F15 indicação ·
F16 formato grupo · F18 dashboards e exclusão de conta.

**F10 — escuta da conversa por IA (pedida em 01/10, depois do piloto).** Transcrição da sessão (a do
Daily ou equivalente) e Claude sobre o texto para resumo e próximos passos. Já fixado: opt-in dos
dois lados a cada sessão (gravação continua desligada por padrão), nunca visível ao RH
(invariante 10), retenção curta, base legal e aviso na política — o nicho de saúde pode trazer dado
sensível —, rota com `maxDuration`, modelo escolhido na hora.

---

## Decisões tomadas

- Modelo B2B: RH compra bloco de fichas e distribui. Multi-tenant é o produto. **Ampliado em
  01/10/2026:** a plataforma também atende Profissional avulso, pessoa física — ver "Profissional
  avulso", no topo. O canal B2B continua de pé; o avulso se soma a ele.
- **Supabase no lugar de Firebase**, decidido antes de qualquer código: RLS protege o isolamento
  entre empresas concorrentes, constraints garantem o livro-caixa, relatório vira query.
- Parceiros pertencem à plataforma; Profissionais pertencem a uma conta — de empresa ou pessoal.
- RH vê utilização agregada, nunca conteúdo nem par profissional↔Parceiro.
- Sessão de 30 minutos apenas no lançamento.
- Fichas acumulam e não expiram; subutilização é combatida por aviso e medida. **Exceção de
  01/10/2026:** ficha comprada pelo avulso vale 12 meses — pacote pré-pago com validade limita o
  passivo de ficha vendida e não usada.
- Sessão tem a duração marcada; o gesto do Parceiro dentro da sala é presentear 1 ficha.
- Parceiro pode ser voluntário, parceria ou remunerado; a plataforma acompanha horas, mas **não
  paga o Parceiro**. Desde 01/10/2026 ela **cobra o avulso** (Asaas) — o dinheiro só entra.
- **Todo Parceiro atende o avulso**, inclusive o voluntário (decisão de 01/10/2026).
- **Asaas, não Stripe nem Mercado Pago (01/10/2026):** Pix e cartão com parcelamento, fatura
  hospedada e NFS-e automática a cada venda — a nota fiscal sai da operação manual.
- Piloto em 30/11 (era 10/11) com operação manual; o único self-service é o cadastro do avulso,
  aprovado pela operadora.
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
- **O modo rápido substitui a rotina inteira, não acrescenta** (superado pela F3 — ver "A grade
  substitui o modo rápido"). Era o que "modo rápido" significava: o Parceiro descrevendo a semana
  dele, não somando uma linha.
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
  spinner nem `animate-pulse`. O sistema de design reserva animação para o presente.
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
- **Migração escolhe o banco por arquivo, não por variável de shell.** `drizzle.config.ts` carrega
  `.env.local` no desenvolvimento e `.env.production.local` quando `DRIZZLE_ENV=production`
  (`npm run db:migrate:prod`), e anuncia host e ref antes de agir. A primeira versão carregava só o
  `.env.local` com `override: true`, e isso tornava produção inalcançável: `DIRECT_URL=… db:migrate`
  migrava o dev calado. Tirar o `override` seria mais curto e pior — com precedência de shell, uma
  variável esquecida no terminal migra o banco errado sem avisar, e migração é a operação que menos
  perdoa. Tocar produção exige **duas** decisões explícitas: criar o arquivo e passar o ambiente.
  `npm run seed:admin:prod` segue o mesmo desenho: carrega `.env.production.local`, exige
  `--producao` (o script do `package.json` passa) e anuncia o ref antes de agir.
- **O `.env.production.local` também é lido pelo `next build` local — e vence o `.env.local`.** É
  convenção do Next: build roda com `NODE_ENV=production` e esse arquivo tem a maior precedência.
  Um `next build` + `next start` na máquina com o arquivo presente sobe a aplicação **escrevendo
  em produção**. `next dev` e o Vitest não o leem, então o dia a dia está seguro; o perigo é o
  build local para reproduzir defeito de deploy. Nesse caso, mover o arquivo antes e apagar o
  `.next` depois.
- **Vercel se opera pelo CLI; o Supabase, pelo MCP em modo leitura.** O MCP da Vercel não conecta
  no Claude Code 2.1.283 — o cliente não consegue ler a descoberta OAuth de `vercel.com`, que
  responde normalmente ao Node e ao `curl`; o contorno por `mcp-remote` autentica e trava depois do
  handshake. `npx vercel` (sem instalar, não é dependência do projeto) cadastra variável com o
  valor vindo por *pipe* direto do arquivo, sem passar pelo chat, e faz `redeploy`. O MCP do
  Supabase fica em `.mcp.json` com `read_only=true` de propósito: migração é `db:migrate:prod`,
  porque aplicar pelo MCP gravaria no registro do Supabase e deixaria o `drizzle.__drizzle_migrations`
  desatualizado.
- **Build sem cache na Vercel pode falhar em `next/font/google` sem defeito no código.** O
  primeiro `redeploy` depois de cadastrar as variáveis rodou sem cache e o Turbopack falhou na
  Instrument Sans (`next/font/google queries have exactly one entry`); o build local limpo do mesmo
  commit passou, e o segundo `redeploy` também. É a fonte baixada do Google durante o build.
  Primeira coisa a tentar: refazer o deploy.

- **O Parceiro pode recusar um pedido pendente, e recusar estorna na hora.** A máquina de estados
  ganhou a aresta `pending ──recusar──▶ cancelled`, com `refund` imediato e `cancelled_by` = o
  Parceiro. Sem ela o "não" já dado esperaria 48h pelo cron, prendendo uma das vagas de
  `max_pending_per_professional` e a ficha do Profissional nesse meio-tempo.
- **Até a P5, sessão confirmada que passou vira `done`.** Sem sala não há presença, e sem presença
  não há como distinguir `done` de `no_show_*`. `close-sessions` marca `done` quando passa `end_at` +
  `session_grace_minutes`; a P5 troca essa regra pela presença lida da sala. Consequência aceita:
  nenhuma sessão da P4 termina em `no_show_*`, nem estorna por falta do Parceiro.
- **O estorno tem uma chave só por sessão: `refund_{bookingId}`.** Expiração, recusa e, depois,
  cancelamento usam a mesma. O Parceiro recusando no minuto em que o cron expira o pedido produz
  **um** estorno — quem chega depois colide na `unique` do livro-caixa. Chave por caminho
  (`expire_…`, `decline_…`) devolveria a ficha duas vezes justamente na corrida.
- **Pedido pendente também expira quando o horário chega.** Com aviso mínimo de 12 h e prazo de
  48 h, um pedido feito na véspera chegaria à hora da sessão ainda "dentro do prazo" e ficaria
  pendente depois de ela ter passado, com a ficha presa. `expire-pending` expira por qualquer das
  duas condições, e confirmar ou recusar depois do início é recusado com "o horário já passou".
- **Toda transição trava a sessão antes de ler o status.** É o `for update` que resolve a corrida
  entre a recusa e o cron: o segundo espera, relê e desiste. A chave `refund_{bookingId}` é a segunda
  cerca. O estorno lê valor e carteira do próprio `spend_{bookingId}` — nunca recebe quantia — e não
  confere o teto da carteira: a ficha já era da pessoa.
- **O Parceiro lê o perfil de quem marcou com ele por uma view, não por policy.**
  `partner_professionals` roda como dona, no molde de `org_usage`, e entrega nome, foto, cargo, área
  e empresa só de quem tem sessão com o Parceiro que pergunta, em qualquer status. Policy em
  `profiles` abriria e-mail e telefone — contato fora da plataforma que a sessão não pede —, e policy
  em `orgs` abriria CNPJ e tamanho do contrato de uma empresa a quem atende as concorrentes dela. O
  filtro exige papel de Parceiro, então o RH não lê par nenhum daqui (invariante 10).
- **A tela e a reserva avaliam a agenda pela mesma função.** `avaliarAgenda` lê regras, exceções e
  ocupação e roda o motor; a reserva a chama dentro da transação, e `horariosLivres` fora dela. Um
  teste percorre todo horário oferecido e confere que a reserva aceita cada um.
- **Instante sai formatado do servidor, no fuso de quem olha.** Os componentes de cliente recebem
  texto e o ISO para devolver; o luxon não vai para o bundle. `lib/formato.ts` ganhou as funções
  de agenda com o fuso como parâmetro, e o default continua o da tela.
- **Na P4 cancelada era sinônimo de recusada** (superado pela F7 — ver "Recusa e cancelamento"). O único caminho para `cancelled` era a recusa do Parceiro;
  a tela chama de "Recusada" e diz que a ficha voltou. "Cancelada" fica para a F7.
- **`send-reminders` saiu da P4 e foi para depois da P5.** Não há Resend, nem chave, nem domínio
  remetente — que depende do nome da plataforma. O piloto é operado à mão; lembrete entra junto com
  o e-mail, com `RESEND_API_KEY` como variável nova nos três ambientes.

- **A sala fecha sozinha em `end_at` + 5 min.** Sem extensão, a hora do fim é conhecida quando a sala
  nasce, e o `eject_at_room_exp` do Daily expulsa no segundo exato (medido no spike). Não há cron de
  encerramento nem chamada a `/eject`. Os 5 min são tolerância de fala, não de sessão: uma de 30 não
  vira 45. O aviso "a reunião terminará em" do Prebuilt aparece nos últimos 5 min antes do `exp` —
  isto é, exatamente em `end_at`. `session_grace_minutes` (15) continua sendo só quando o fechamento
  decide o status.
- **Presença vem de `/meetings`, lida no fechamento, não de webhook.** `close-sessions` pergunta ao
  Daily quem entrou em cada sala vencida e grava `session_events` e `attended_*` na transação que
  decide `done`/`no_show_*`. Sem endpoint público, sem bypass da proteção do Preview, sem
  deduplicação de evento repetido — e idempotente, porque a transição trava a sessão e confere o
  status. Daily fora do ar não fecha nada: a sessão espera a próxima rodada (dado falha alto). O
  webhook fica para quando houver uso em tempo real.
- **Um domínio Daily por ambiente.** O domínio aceita um webhook só e a chave é por domínio: com um
  domínio só, sala de teste chegaria à produção. `tostes` é Preview/Development; Production ganha
  domínio próprio, com chave própria cadastrada só lá — e ele depende do nome da plataforma.
  **Exceção provisória, decidida em 27/09:** até o domínio próprio existir, a produção usa o
  `tostes`, com a mesma chave. Não há colisão de sala — o nome é o `booking_id` —, e sem webhook não
  há evento cruzado. O custo é que a chave de Development, que fica no `.env.local` e não é
  *sensitive*, abre e lê salas de produção. A chave colada no chat do spike foi girada em 28/09. A
  mídia continua em São Paulo porque o `geo` vai em cada sala, não só no domínio.
- **Mídia em São Paulo; o Daily sabe o mínimo.** `geo: "sa-east-1"` no domínio de produção,
  `user_name` = primeiro nome, `user_id` = `profiles.id` opaco, gravação desligada. Os metadados de
  reunião ficam no Daily (EUA): transferência internacional (LGPD art. 33) a constar na política.
- **Iframe do Prebuilt no piloto, sem `daily-js`.** Medido em 28/09 (`docs/spike-video.md` §6):
  `redirect_on_meeting_exit` só existe no **token** (na sala é 400), leva o iframe para o endereço
  dado quando a pessoa clica em sair, e **não** age na expulsão pela expiração. Então a tela de fim
  tem dois caminhos: a página troca o iframe pela nossa tela quando o relógio passa de `end_at` + 5
  (o fim normal), e o token aponta o redirecionamento para uma página nossa que manda a janela de
  cima para a mesma tela (a saída voluntária). Em `localhost` o redirecionamento não chega — o
  Chrome barra página pública navegando para a rede local; em Preview funciona.
- **O presente: 1 por sessão, só na sala, fora do teto e fora do contrato.** `wallet_ledger gift
  (+1)` e `gift_quotas.gifts_used + 1` na mesma transação, com chave `gift_{bookingId}` — a segunda
  tentativa colide, e é o banco que garante o "1 por sessão". Só o Parceiro da sessão, sessão
  `confirmed`, do início até a sala fechar. Ignora `max_balance` porque recusar o presente na frente
  do Profissional seria o pior momento possível para um limite, e a cota (3 por mês) já o limita. Não
  debita `org_ledger`: a ficha não saiu do contrato da empresa, saiu do Parceiro.
- **A cota do presente é a coluna do Parceiro, não `app_config`.** `partners.gift_quota_monthly` é
  da pessoa e a operadora pode mudá-la para um só; `ficha_policy.gift_quota_monthly` fica como a
  política da plataforma. A cota é conferida e gasta num comando só (`insert … on conflict do update
  … where gifts_used < cota`), porque ler e depois somar perderia a corrida entre duas sessões do
  mesmo Parceiro. O mês é o de São Paulo, a mesma fronteira da recarga.
- **A extensão saiu do esquema, não só da tela.** A migração `sala_e_presente` derruba
  `bookings.extended_by`, `partners.extension_quota_monthly`, `gift_quotas.extensions_used` e a chave
  em `app_config`. Coluna morta com nome de regra viva é convite para alguém reimplementá-la sem
  saber por que caiu.
- **Utilização conta uso líquido sobre tudo o que foi recebido.** Achado na P5: desde a P4 existe
  estorno, e `org_usage` só tinha gasto bruto — pedido recusado contava como ficha usada, no painel
  da operadora e no "Já usadas" de `/fichas`. No `mentoria-dev` a Faculdade Aurora aparecia com 86%
  (6 ÷ 7) e o número certo era 43% (3 ÷ 7). A view ganhou `fichas_used` (gasto − estorno) e
  `fichas_extra` (presente + compensação, que chegam sem sair do contrato e, gastas, empurrariam a
  taxa acima de 100%). A conta do Profissional é `fichasUsadas` em `lib/ledger/uso.ts`, com o mesmo
  critério.
- **Sem chave do Daily, o fechamento volta à regra da P4.** Sem sala ninguém teria como entrar, e
  marcar `no_show_professional` em toda sessão seria inventar falta — com a ficha indo embora junto.
  É o caso da produção enquanto não houver domínio próprio. Com chave e Daily fora do ar é o
  contrário: a sessão não fecha e fica para a próxima rodada, porque aí existe sala e o que falta é
  a resposta dela.
- **O `room_name` é gravado antes de qualquer chamada ao Daily.** O fechamento só pergunta ao Daily
  por sessão com `room_name`; sem ele, ninguém recebeu token, logo ninguém entrou. Gravar depois
  abriria a janela em que a pessoa entra, a escrita falha e o fechamento a dá como ausente.
- **Compareceu é quem esteve na sala durante `[início, fim)`.** Testar a câmera às 8h52 e sair não
  conta; chegar às 9h10 e ficar conta; entrar na tolerância depois do fim não conta. A presença é
  casada por `user_id` = `profiles.id`, e cada entrada vira duas linhas em `session_events`
  (`participant.joined`, `participant.left`) — os nomes de evento do webhook do Daily, para o dia em
  que ele entrar gravar o mesmo vocabulário.
- **A falta do Parceiro estorna e compensa com `adjust`, não `gift`.** Presente é gesto do Parceiro e
  conta na cota dele; compensação é a plataforma reparando uma falha. Chave `noshow_{bookingId}`,
  valor de `partner_no_show_bonus` (zero desliga). As duas entram em `fichas_extra`.
- **Motivo no livro-caixa não leva nome de ninguém.** "Presente recebido na sessão", e não "Presente
  de Helena": o livro-caixa é imutável e sobrevive à anonimização da LGPD — um nome ali seria o único
  que a exclusão de conta não alcança.
- **A sala é uma rota só, `/sala/[id]`, dos dois papéis, fora da casca.** O protótipo falava em
  duas; a sala é a mesma para os dois lados e só o painel muda. A tabela de acesso barra o papel
  (`/sala` é de Profissional e Parceiro, e de mais ninguém — nem da operadora); quem é participante
  de qual sessão, a página confere pela RLS de `bookings` e de novo no código, porque a policy deixa
  a equipe ler e ler não é participar. Fora da sidebar porque no celular não cabem navegação e
  chamada juntas.
- **O token não vai no HTML.** A página renderiza sem ele e o cliente pede ao montar. O Prebuilt
  consome o `?t=` na primeira leitura, então um token no HTML voltaria inútil a cada recarga — e
  ficaria no cache do navegador sem servir para nada.
- **O relógio da sala conta pelo relógio do servidor.** A página manda o instante em que renderizou
  e o cliente soma o deslocamento: celular com hora errada não faz a tela de fim aparecer antes ou
  depois do Daily expulsar. A fase (antes, sessão, reta final, tolerância, fechada) é função pura em
  `lib/video/relogio.ts`, com teste, porque é ela que troca o vídeo pela tela de fim.
- **O presente chega ao Profissional por consulta de 15 s, sem canal em tempo real.**
  `GET /api/sessoes/[id]/presente` lê o próprio extrato pela RLS dele. Realtime do Supabase exigiria
  publicação da tabela e autorização de canal para um evento que acontece, no máximo, uma vez por
  sessão; 15 s de atraso não estragam o momento.
- **A falta muda de nome com quem olha.** Quem faltou lê "Você não entrou"; quem ficou esperando lê
  "{Parceiro} faltou" ou "Não compareceu". `rotuloDoStatus` recebe o lado e o termo; sem eles, o
  rótulo neutro de antes continua valendo.
- **Corrigir a presença marca as duas.** `done` é "os dois estiveram lá", e quem afirma que a sessão
  aconteceu estava nela. Achado rodando: a sala que perdeu os dois deixava `done` com
  `attended_partner = false`. Sem efeito em dinheiro — a falta do Profissional não estorna. A
  auditoria guarda as duas presenças de antes e de depois.
- **A correção fica na coluna do meio, abaixo da frase que ela responde.** Na coluna do selo, a
  confirmação aberta espremia nome e horário numa coluna de uma palavra por linha (visto na foto da
  verificação).

- **Senha provisória é marca em `app_metadata`, não coluna de `profiles`.** Toda senha dada por
  outra pessoa — criação pelo admin, senha nova pelo admin, e as contas que já existiam (migração
  `senha_provisoria`) — leva `app_metadata.senha_provisoria = true`. Três motivos: chega no JWT e
  vira `Session.senhaProvisoria` sem consulta (a casca renderiza em paralelo com a página); só o
  `service_role` escreve, então ninguém se livra do aviso sem trocar a senha; e `profiles` é legível
  por colegas de empresa, que não precisam saber quem ainda usa a senha que chegou pelo WhatsApp.
  O `seed:admin` marca quando sorteia e não marca quando a senha vem por `--senha`.
- **A troca confere a senha atual, troca, e só então tira a marca.** A atual é conferida por um
  cliente avulso, sem cookie, cuja sessão é encerrada com `scope: "local"` (o `global` derrubaria a
  sessão em que a pessoa está). A troca vai pela sessão da própria pessoa (`updateUser`), a marca sai
  pelo `service_role`, e `refreshSession()` põe no cookie um token sem ela — sem isso o aviso ficaria
  até o token vencer. Medido contra o `mentoria-dev`: a sessão sobrevive à troca, e os códigos
  `same_password` e `invalid_credentials` chegam como esperado. Se a marca não sair, o aviso volta
  para quem já trocou: incômodo, não inseguro.
- **O aviso não bloqueia.** Abre sozinho ao entrar; "Agora não" vale até a próxima entrada, porque a
  casca não remonta ao navegar. Fica uma bolinha dourada no menu da conta enquanto a marca existir.
  A sala (`/sala/[id]`) não tem casca e não mostra o aviso — ninguém troca senha no meio da sessão.
- **Trocar a própria senha não grava `audit_logs`.** Mesma leitura de "Parceiro mexendo em si": a
  invariante 12 é sobre ação sobre terceiro. A senha nova gerada pelo admin continua auditada.
- **A janela de senha vai por portal para o `body`.** O menu da conta mora na parte da sidebar que no
  celular fica `display: none`, e um `<dialog>` dentro de pai escondido não aparece nem com
  `showModal()`.

- **Protótipo no código, não em HTML à parte (29/09/2026).** O protótipo HTML single-file era
  refeito depois em React: tudo o que a aprovação ajustava era retrabalho em dobro, e o HTML não
  tinha dado real, vocabulário do banco nem o comportamento de verdade. Agora a tela é construída
  na aplicação e aprovada rodando. O menu da conta foi o primeiro caso.

- **Cancelar vale até a sala abrir, dos dois lados (F7, 29/09/2026).** Depois de início − 10 min
  já pode haver alguém na sala, e quem não vier é falta — a presença resolve. Como a sala só nasce
  dentro da janela, nenhuma sala do Daily fica aberta para sessão cancelada.
- **O Profissional cancela depois do prazo e perde a ficha.** Pedido pendente devolve sempre;
  confirmada devolve até `cancel_window_hours` antes do início. Depois disso ainda pode cancelar —
  o horário volta para a agenda do Parceiro —, mas a ficha conta como usada, igual à falta. Com
  `min_notice_hours` igual à janela, quem marca em cima da hora cancela sem estorno: aceito.
- **O Parceiro cancela sessão confirmada e a ficha volta sempre; em cima da hora, compensa.** Com
  menos de `cancel_window_hours`, o Profissional recebe também `partner_no_show_bonus`, com a mesma
  chave `noshow_{bookingId}` da falta — cancelar em cima da hora é falta avisada. Pedido pendente o
  Parceiro não cancela: recusa.
- **A tela diz o que vai acontecer com a ficha, e o servidor confere que ainda é verdade.** O
  corpo de `POST /api/bookings/:id/cancelar` é `{ estorna, compensa }` — o que a frase lida
  prometeu. Se o prazo virou entre a página abrir e o clique, o veredito muda e a transação
  recusa com 409 em vez de mover a ficha de um jeito que a pessoa não leu. Tela e transação
  decidem pela mesma função pura, `regraDoCancelamento`.
- **Recusa e cancelamento: mesmo status, histórias diferentes.** `SessaoNaAgenda.cancelamento`
  guarda quem cancelou e se ainda era pedido (`confirmed_at` nulo — a confirmação automática da
  reserva também o preenche). Parceiro diante de pedido é "Recusada"; o resto é "Cancelada", em
  vermelho só para o Profissional que teve a sessão desmarcada pelo Parceiro.
- **O histórico diz o que o livro-caixa registrou, não o que o status sugere.** Cancelar a tempo e
  depois do prazo dão o mesmo `cancelled`; o que separa os dois é o `refund`. A agenda do
  Profissional lê os lançamentos de cada sessão pelo próprio extrato (`movimentosPorSessao`); a do
  Parceiro, em quais sessões dele houve presente ou compensação (`movimentosDoParceiro`,
  privilegiada, sem valor nem saldo).
- **Cancelar não grava `audit_logs` nem avisa ninguém.** É a pessoa mexendo na própria sessão, como
  a recusa; `cancelled_by` e `cancelled_at` ficam na linha. O outro lado vê na agenda — aviso por
  e-mail chega com o Resend, e a tela do Parceiro diz isso.

- **A grade substitui o modo rápido; o modo rápido virou atalho (F3, 30/09/2026).** Uma tela só
  edita a semana inteira, dia a dia, com até 6 faixas por dia, e salva tudo de uma vez — apaga e
  reinsere `partner_rules`, como antes. "Mesmo horário em vários dias" só preenche a grade no
  cliente; nada é salvo sem o Parceiro ver o resultado, e por isso o aviso de "vai sobrescrever"
  que a P2 previa deixou de ser necessário. Faixas sobrepostas no mesmo dia são recusadas (o motor
  as uniria, mas quem digitou 9–12 e 11–13 errou um dos dois); encostadas passam. A validação é
  `validarGrade`, em `lib/parceiro/grade.ts`, e roda nos dois lados: no cliente, enquanto a pessoa
  digita, e no servidor.
- **Folga é uma linha por dia em `partner_exceptions`, sem `reason`.** É o que o esquema guarda e o
  motor lê; a tela agrupa dias seguidos iguais em um período e remove o grupo inteiro. O período vai
  até 92 dias por vez. O motivo fica de fora porque a policy de leitura abre as exceções de Parceiro
  ativo a **todo** autenticado — é a agenda pública dele —, e "cirurgia" escrito ali seria lido por
  Profissional de qualquer empresa. Horário extra vale num dia só e precisa de faixa de pelo menos uma
  sessão; folga vence extra no mesmo dia (ordem do motor desde a Etapa 5).
- **Folga não desmarca sessão.** Fecha a agenda para pedido novo; a sessão que já existe continua,
  e a tela diz quantas caem no período, na mensagem de sucesso e na linha da folga. Cancelar mexe na
  ficha de outra pessoa e é gesto explícito, pela agenda (F7) — nunca efeito colateral de um
  formulário de disponibilidade.
- **Formulário com campo controlado envia por `onSubmit`, não por `action`.** Achado rodando na F3:
  com `action`, o reset do React 19 depois da ação deixou o checkbox "Dia inteiro" marcado no DOM com
  o estado dizendo o contrário, e a tela mostrava "dia inteiro" e as horas ao mesmo tempo — o
  próximo envio mandaria o que a tela não mostrava. `useEnvioSemReset` resolve, como já resolvia a
  edição.

- **A ficha da conta pessoal passa pelo contrato dela (A1, 02/10/2026).** O crédito do pacote lança
  `purchase (+n)` e `allocate (−n)` no `org_ledger` da `org` individual e `allocate (+n)` na
  carteira, numa transação — o livro-caixa conta a mesma história nos dois canais, e
  `contracted_fichas` vira o total comprado. Chave `pay_{paymentId}` nos dois livros e
  `payalloc_{paymentId}` na segunda linha do contrato. `creditoNaTransacao` (`lib/ledger/credito.ts`)
  é **a** porta: o registro manual da operadora a chama hoje, o checkout (A4) vai chamá-la de três
  lugares. Trava o pagamento `for update`: já `confirmed` devolve o crédito sem lançar; outro status
  que não `pending` recusa.
- **Os dois canais não se cruzam, e quem recusa é a transação.** `compraNaTransacao` e
  `alocacaoNaTransacao` recusam conta pessoal; `compraManualNaTransacao` recusa colaborador de
  empresa (`TipoDeContaErrado`). A tela de empresa não abre `org` individual (`buscarEmpresa` filtra
  o tipo), mas a cerca de verdade é a de dentro: um POST forjado bate nela.
- **O restante do lote é derivado, e uma regra o mantém fechando.** Não há coluna de restante em
  `ficha_lots` — é `sum(amount) where lot_id`. A regra que impede a conta de furar: **ficha sem lote
  só sai quando nenhum lote tem ficha** (`loteParaGasto`, em `lib/ledger/lotes.ts`). Com ela o
  saldo é sempre restantes dos lotes + um resto sem lote que nunca fica negativo, e a baixa do
  vencimento nunca leva a carteira abaixo de zero. A FK composta `(lot_id, user_id)` impede
  lançamento apontar para lote de outra pessoa; o lote é imutável por trigger.
- **Lote vencido e não baixado ainda vale.** A validade é aplicada pela baixa diária (A5); até ela
  rodar, o gasto usa o lote vencido primeiro, que é o que a pessoa escolheria. **O estorno volta ao
  mesmo lote — ou sem lote, se ele venceu**: a ficha presa num pedido recusado não morre por um
  prazo que correu enquanto ela estava presa.
- **A conta pessoal tem um dono só, pelo banco.** `trg_profiles_individual_org` recusa segundo
  perfil e `org_admin` numa `org` individual (travando a `org` antes de contar), e
  `trg_orgs_kind_immutable` impede trocar o tipo depois. A `org` leva o nome da pessoa porque `name`
  é obrigatório; o feed de atividade e `partner_professionals` escondem esse nome quando o tipo é
  individual, para ele não aparecer como "empresa".
- **O tipo da conta vem do token: claim `org_kind` (A1).** A tela do Profissional muda de texto —
  "o RH da sua empresa distribui" vira o pacote, e a promessa de privacidade vira "nenhuma empresa
  vê" — e a casca renderiza em paralelo com a página, onde consultar `orgs` entalaria a conexão. O
  hook escreve `org_kind` junto de `org_id`; `Session.tipoDeConta` lê, e a ausência vale `empresa`
  (token anterior à claim só pode ser de empresa). As frases moram em `lib/profissional/conta.ts`.
- **Contrato, utilização e contagem de Profissionais são só de empresa.** `org_usage` junta `orgs`
  com `kind = 'empresa'`; o painel conta "Contas pessoais" à parte e tira o que elas compraram de
  "fichas contratadas".
- **Formulário de pacote envia por `action`, com rádio não controlado.** O contrário da F3, e pelo
  mesmo motivo de fundo — o DOM não pode discordar do que a tela mostra. Aqui o reset é desejado:
  mantido preenchido depois do sucesso, um segundo clique registraria o mesmo pacote de novo com
  outro token. A borda do pacote escolhido acompanha `:checked` por classe, sem estado.

- **O login do avulso nasce no `signUp`, com a senha dele (A3, 06/10/2026).** Por um cliente sem
  cookie (`clienteAvulso` em `lib/cadastro/index.ts`): o cadastro não deixa ninguém logado, e com
  confirmação de e-mail o `signUp` nem devolve sessão. O pedido vai para `individual_signups` pela
  conexão de servidor logo depois. Login e pedido não cabem numa transação; se o SQL falhar, o
  login recém-criado é apagado, como em `pessoas/criar.ts`. Enquanto pendente não há perfil, então
  o hook não põe `user_role` e toda policy nega — a fila não precisou de policy nova.
- **E-mail que já tem conta não é erro, e a tela é a mesma.** Medido no `mentoria-dev`: o `signUp`
  de um e-mail existente responde sem erro, com usuário sem identidade, e não envia nada — o
  servidor de auth não deixa o cadastro virar consulta de quem tem conta. O pedido não é gravado e a
  tela de "confira seu e-mail" avisa que a conta pessoal pede um endereço diferente do corporativo.
  Enviar de novo antes da decisão atualiza o pedido aberto (índice de um pendente por e-mail), sem
  segunda linha na fila.
- **A página de chegada não abre sessão.** O link passa pelo servidor de auth, que confirma o e-mail
  antes de redirecionar; chegar a `/cadastro/confirmado` sem erro já é a confirmação feita. O
  fragmento traz tokens de uma sessão sem papel: o cliente lê só o `error_code` e apaga o resto da
  barra. O destino do link é a origem do POST (cabeçalho `Origin`, conferido pelo Next) e tem de
  estar na lista de redirecionamento do Supabase Auth; fora dela, cai no Site URL.
- **Aprovar exige e-mail confirmado, e a conta é a mesma da operadora.** `aprovacaoNaTransacao`
  trava o pedido, recusa o que não está pendente, o que perdeu o login e o que não confirmou o
  e-mail, e chama `contaPessoalNaTransacao` com `acao: "aprovar_cadastro"` — uma linha de auditoria,
  não duas. O e-mail do perfil é o do login. Sem senha provisória: a senha é da pessoa.
- **Recusar: decisão no banco primeiro, login apagado depois.** Apagar antes e falhar no SQL deixaria
  pedido sem login; pior, entre a leitura e o `delete` outra pessoa da operadora poderia aprovar, e
  apagar o login levaria em cascata o perfil recém-criado. Com a trava, a aprovação concorrente
  espera e desiste. O login que a chamada HTTP não conseguir apagar é apagado pela rodada diária.
  A auditoria da recusa não leva nome, e-mail nem motivo: `audit_logs` é imutável e o pedido é
  anonimizado em 90 dias — o motivo fica só no pedido, que a anonimização alcança.
- **Anonimização por coluna, não por convenção.** `individual_signups.anonymized_at` (migração
  `cadastro_anonimizado`), com `check` que só a permite em pedido recusado. A rodada troca nome,
  contato, objetivo e motivo e põe um e-mail inexistente com o id do pedido; a linha fica, para a
  fila contar que houve um pedido e uma decisão.
- **A entrada distingue dois estados novos sem vazar quem tem conta.** `email_not_confirmed` só
  chega depois de a senha conferir, então quem lê a frase é o dono. Login sem papel com pedido
  pendente lê "seu cadastro está em análise"; sem pedido, continua "acesso inativo".
- **A fila aprova em lote, uma transação por pessoa.** Como a recarga mensal: um e-mail ainda sem
  confirmar não impede os outros, e o que não passou volta na mesma tela, com o nome. Só pedido
  confirmado tem caixa ligada. As respostas e o estado vazio moram no componente da fila, não na
  linha nem na página: decidir o último pedido trocava a lista pelo vazio e levava a frase junto
  (achado rodando). Aprovar e recusar são só da `admin`; a moderação lê.
- **O formulário de cadastro envia por `onSubmit`.** Com `action`, um erro de validação apagaria o
  texto sobre o que a pessoa busca — o mesmo motivo da edição. Campo-armadilha invisível para robô:
  quem o preenche recebe a tela de sucesso e nenhum pedido é gravado.
- **SMTP padrão do Supabase não serve a público.** Medido em 06/10: depois de um envio, o segundo
  `signUp` da hora voltou `over_email_send_rate_limit`; e, pela documentação do Supabase, o
  padrão só entrega a endereços da equipe do projeto. A tela diz "muitos cadastros, tente em alguns minutos" e nada fica para trás (nem
  login, nem pedido). **O cadastro só abre ao público depois da A2** (SMTP próprio nos dois projetos).
- **"Esqueceu a senha?" entrou junto, a pedido (07/10/2026), para todos os papéis.** Link na
  entrada, `/recuperar-senha` pede o e-mail (`resetPasswordForEmail`, mesma frase exista ou não a
  conta) e `/redefinir-senha` recebe o link. Os tokens vêm no fragmento: o cliente os lê uma vez
  (ref, por causa do modo estrito), apaga a barra e os manda com a senha nova. O `type=recovery` do
  fragmento não prova nada — qualquer um o escreve. O que prova é o token assinado: medido no
  `mentoria-dev`, sessão aberta por link de e-mail tem `amr` `otp` com o instante da verificação, e
  a entrada por senha tem `password`. `redefinirPorLink` exige `otp` de até 15 minutos; sem isso, um
  cookie de sessão comum roubado trocaria a senha sem saber a atual (verificado: recusado). Depois da
  troca, a marca de senha provisória sai e **todas** as sessões da pessoa são encerradas.
  `/redefinir-senha` abre com ou sem sessão (`OPEN_PREFIXES`): mandar quem está logado para a casca
  levaria o fragmento junto e perderia o link. Sem auditoria — é a pessoa mexendo em si.

- **Cor virou token (F4a, 07/10/2026), e a regra "hex inline, nunca CSS variables" caiu.** Pedido
  seu: todas as cores da marca por empresa. Com 522 hex escritos em 74 componentes isso era
  impossível — e 35 deles eram o próprio magenta padrão, que já aparecia na casca verde da Aurora.
  Agora cada cor é um token do Tailwind (`@theme inline` em `globals.css`) que lê `--cor-*`, e o
  layout raiz escreve essas variáveis em `<html style>` com `variaveisDoTema(theme)`, no servidor —
  sem piscar o padrão antes da marca. Os derivados do accent (`accent-10`, `accent-12`,
  `accent-line`, `on-accent`, `on-soft`) saem de `variaveisDoTema`, com o mesmo `withAlpha` e
  `onAccent` de antes, e não do `color-mix` do Tailwind: é o que mantém o tema padrão igual pixel a
  pixel. A troca de classes foi mecânica (script fora do repositório) e conferida por captura de
  tela antes e depois. `lib/cores.test.ts` recusa hex em componente e confere que o default de
  `globals.css` é `variaveisDoTema(DEFAULT_THEME)`. Ouro, sucesso, erro e a sala escura são fixos.

- **A paleta inteira sai do accent (F4b, 07/10/2026).** Trocar só o accent deixava botão verde
  sobre fundo rosado — o que a Aurora mostrava. `paletaDoAccent` gira cada tom do padrão pela
  diferença de matiz entre o accent novo e o magenta, acompanha a saturação (com teto de 1,25×) e
  **não mexe na luminosidade**: o fundo continua claro e o texto escuro, então o contraste do padrão
  sobrevive (texto sobre cartão acima de 15:1 em verde, azul, laranja, cinza e amarelo). O `deep`
  acompanha a luminosidade do accent, porque é a versão escura dele. O accent padrão devolve o
  padrão exato — teste.
- **Ajuste fino guarda só a diferença.** `branding.cores` tem apenas a cor que a operadora mudou e
  que difere da derivada (`ajustesDaMarca`), na ordem de `CORES_DA_MARCA`. Guardar a derivada
  congelaria a cor: trocar o accent depois deixaria um fundo do accent antigo. Com accent próprio,
  o ajuste fino da plataforma não vale para a empresa (`mergeBranding`).
- **Texto ilegível não salva; accent fraco salva com aviso.** Texto sobre cartão ou fundo abaixo de
  4,5:1 é recusado na tela e na ação (`problemasDeLeitura`) — quem descobriria é o colaborador. Accent
  ou texto secundário abaixo de 3:1 contra o cartão só avisa (`avisosDeContraste`): marca amarela
  existe, e a decisão é da operadora.
- **Logotipo por endereço `https`, sem upload, por enquanto.** Vai num `<img>` em toda tela da
  empresa, e `http` numa página `https` some sem erro. Subir o arquivo pelo Supabase Storage pede
  bucket e policy — fica para quando a cliente tiver marca.
- **O formulário lê a marca como gravada, por consulta que falha alto.** `buscarEmpresa` traz
  `branding` cru; `loadOrgBranding` degrada para vazio com o banco fora do ar, e salvar em cima do
  vazio apagaria a marca. A prévia é o mesmo `resolveTheme` + `variaveisDoTema` do layout raiz,
  escrito no `div` dela — as variáveis do `div` vencem as do `<html>`, com as classes de sempre.
- **Marca é da empresa; a conta pessoal fica com a da plataforma.** `marcaNaTransacao` trava a
  `org` com `kind = 'empresa'` e recusa o resto (`EmpresaInexistente`). Auditoria `editar_marca`
  com a diferença, no molde da edição de pessoas; salvar sem mudar nada não grava linha.
- **A casca do celular não estica em página curta.** O grid do `AppShell` é `min-h-screen`, e com
  pouco conteúdo as duas linhas cresciam para preencher a tela — a barra do topo virava uma faixa
  branca de 200px. `max-lg:content-start` (achado rodando na `/admin/personalizacao`).

## Descartado

- Firebase / Firestore. - Chat livre fora da janela de 24h da sessão. - Ranking público.
- Gravação por padrão. - Marketplace de cursos.
- ~~Pagamento dentro da plataforma.~~ Reaberto em 01/10/2026 com o avulso: ele paga pelo Asaas.
- Extensão de sessão dentro da sala (27/09/2026). O spike mostrou que o Daily fixa a hora de
  expulsão na entrada de cada pessoa: estender exigiria cron de minuto em minuto chamando `/eject`,
  ou derrubar as duas telas para reentrar com token novo. O presente ocupa o lugar do gesto.

## Em aberto

- Nome da plataforma, domínio e identidade visual.
- O RH escolhe quais Parceiros sua empresa enxerga, ou todos veem todos?
- Parceiro pode recusar atender determinada empresa?
- Profissional que sai da empresa: `reclaim` automático ou manual?
- Parceiro ganha ficha por hora doada? (`flags.partner_earns_fichas`, default false)
- Nome da plataforma até 10/10/2026 — caminho crítico do piloto (domínio, e-mail, Asaas, Daily).
- Textos legais dos dois canais (operadora), até a A5.

---

## Estado atual

Fase: **F4 (marca por empresa) pronta na branch `f4`, esperando sua aprovação** — trazida para
dentro do piloto em 07/10/2026, a pedido, enquanto a A2 espera o nome. Sem migração: `orgs.branding`
já era `jsonb` e só ganhou a chave `cores`. **F4a**: cor virou token (`--cor-*` em `<html style>`,
tema padrão igual pixel a pixel). **F4b**: cartão "Marca" em `/admin/empresas/[id]` — cor
principal, nome na marca, logotipo por endereço `https`, ajuste fino das 13 outras cores e prévia
ao vivo —, e `/admin/personalizacao` (era página vazia) com a marca de cada empresa. Exercitada no
`next dev --webpack` contra o `mentoria-dev`, por clique com Chrome sem tela, desktop e 390px, sem
erro de console: a Aurora foi para azul com fundo ajustado, a casca da Mariana mudou inteira, e
"Voltar à marca da plataforma" mais o verde a devolveram ao `{"accent":"#2E6B52"}` de antes (duas
linhas de `editar_marca` ficam na auditoria do `mentoria-dev`).

**Achado na verificação da F4b, anterior a ela e ainda sem correção:** requisições
**simultâneas** entalam a conexão Drizzle de `max: 1` do mesmo jeito que o `Promise.all` — o
`Promise.all` é só o caso de dentro de uma requisição. Reproduzido no `next dev` limpo: 12
requisições de páginas da operadora em paralelo, 2 respondem e 10 ficam paradas até o limite de
90 s, e o processo inteiro deixa de responder; as mesmas 12 em sequência respondem em menos de
0,5 s. No mesmo período apareceram `RangeError: Invalid time value` em `/admin/contas-pessoais` e
`cnpj(undefined)` em `/admin/empresas`, intermitentes — compatíveis com resposta entregue à consulta
errada, o que seria pior que a trava. Em produção depende de a Vercel servir mais de uma requisição
por instância (Fluid compute). **A próxima sessão deveria começar por aqui**, antes de qualquer
feature: reproduzir contra o Preview, confirmar o modo de concorrência do projeto e decidir a
correção (fila por conexão, pool maior no pooler de transação ou conexão por requisição).

Antes dela: **A3 (cadastro e fila) na `main` e em produção desde 07/10/2026** — aprovada por você e
publicada por fast-forward da `a3`, depois de `db:migrate:prod` aplicar `cadastro_anonimizado` no
`mentoria` (conferida por consulta: 10 migrações, `anonymized_at` e o `check`). Deploy `Ready`,
`/api/health` ok, as quatro rotas públicas 200, `/admin/cadastros` 307 sem sessão, cron 401.
Adiantada para antes da A2 em 06/10/2026, porque a A2 espera o nome da plataforma. A próxima é a
A2, quando o nome sair; sem ela, cadastro e recuperação não entregam e-mail a quem é de fora.
Exercitada no `next dev
--webpack` (porta 3000, a que o `mentoria-dev` aceita como destino da confirmação) contra o
`mentoria-dev`, por clique com Chrome sem tela, desktop e 390px, sem erro de console: entrada com
e-mail sem confirmar, link de confirmação (e o mesmo link de novo, vencido), entrada "em análise",
fila com caixa desligada para quem não confirmou, recusa com motivo apagando o login, aprovação em
lote e a primeira entrada da conta aprovada com a própria senha. Mais o "Esqueceu a senha?", pedido
na aprovação: link na entrada, pedido do link, link aberto, senha nova, link reaberto vencido, senha
antiga recusada e sessão de senha forjada no fragmento recusada. "Lia Fontes" fica no `mentoria-dev`
como conta pessoal aprovada pelo cadastro (senha redefinida na verificação). **Configuração pendente no painel do Supabase Auth**
(URL Configuration → Redirect URLs): no `mentoria-dev`, `https://*-tostess-projects.vercel.app/**`
para o Preview; no `mentoria`, `https://mentoria-bay.vercel.app/**` — e conferir o Site URL dos dois.

Antes dela: **A1 (conta individual) na `main` e em produção desde 06/10/2026** — plano do avulso
aprovado em 01/10/2026, ver "Profissional avulso" e "Roadmap". `db:migrate:prod` aplicou
`conta_individual` no `mentoria` antes do push (conferida por consulta: 9 migrações, `orgs.kind` e
`cpf`, as três tabelas novas com RLS, `expire` no enum, hook com `org_kind`, pacotes em
`app_config`); fast-forward da `a1` na `main`. Exercitada no
`next dev --webpack` contra o `mentoria-dev`, por clique com Chrome sem tela, desktop e 390px, sem
erro de console: a operadora criou a conta pessoal "Joana Ribeiro" e registrou o pacote Ritmo
(fica no `mentoria-dev` como dado de demonstração — o livro-caixa não deixa apagar).

Antes dela: **F3 (grade semanal e folgas) na `main` e em produção desde 30/09/2026**, aprovada no
Preview da `f3` e publicada por fast-forward. Sem migração:
usa `partner_rules` e `partner_exceptions` como a Etapa 3 as criou, escrevendo pela RLS do Parceiro.
O motor não mudou — já calculava regra, extra e bloqueio desde a Etapa 5.

Antes dela: **F7 (cancelamento) na `main` e em produção desde 30/09/2026**, por fast-forward da
`f7`. Sem migração: usa as colunas `cancelled_at`/`cancelled_by` que existem desde a Etapa 3. A
`conta` entrou na `main` e em produção em 29/09, com a migração `senha_provisoria` aplicada no
`mentoria` antes do push.

Antes dela: **P5 na `main` e em produção desde 27/09/2026.** Protótipo aprovado em 28/09 (com o presente
chegando por consulta de 15 s e a correção de presença só do Profissional). O vídeo funcionou no
celular pelo Preview da `p5`; a migração `sala_e_presente` foi aplicada no `mentoria` antes do push.
Em produção o vídeo roda, provisoriamente, no domínio de teste `tostes` (chave cadastrada em
Production e redeploy em 27/09). Falta, quando o nome sair, o domínio próprio — ver
"P5 — o que falta para o piloto", abaixo. O piloto espera ainda o `send-reminders` (P5+), que espera
o Resend e o domínio remetente.

O piloto já tem o ciclo da ficha inteiro sem vídeo: o Profissional acha um Parceiro em `/parceiros`
(primeiro horário livre de cada um, no fuso dele), escolhe um horário em `/parceiros/[id]` e agenda;
o Parceiro confirma ou recusa em `/parceiro/sessoes`, vendo nome, cargo e empresa de quem pediu; a
recusa e o `expire-pending` devolvem a ficha pela mesma chave; o `close-sessions` marca `done`. Os
dois lados têm início e agenda.

A economia da plataforma anda sozinha de ponta a ponta. A operadora compra o bloco e aloca à mão; o
cron `allocate-monthly` recarrega no dia 1º somando o valor do mês até o teto, idempotente por
`alloc_{userId}_{YYYYMM}`; e `POST /api/bookings` transforma ficha em sessão numa transação só —
recalculando a agenda no motor antes de escrever, travando a carteira para serializar as reservas
daquele Profissional, e deixando a sobreposição para a constraint do banco decidir.

O Profissional vê o próprio dinheiro em `/fichas`: saldo, extrato do `wallet_ledger` com rótulo em
português, e o que a ficha vale. A sidebar dele mostra o saldo real — os números de exemplo da
Etapa 1 saíram de todas as cascas, sem serem trocados por falsos onde a fase ainda não chegou.

O **motor de agenda** (`src/lib/scheduling/`) segue travado. A tela do Profissional e a reserva o
consomem pela **mesma** função, `avaliarAgenda` em `lib/bookings/operacoes.ts`, e um teste prova
que todo horário oferecido é aceito pela reserva. A tela de disponibilidade do Parceiro lê pela
sessão dele. Os limites de `app_config` chegam a todos por `limitesDoMotor`.

A **sala** é `/sala/[id]`, dos dois lados, fora da casca: o Prebuilt num iframe, o relógio nosso
por fora (começa em / faltam / termina em, dourado nos últimos 5 min, vermelho na tolerância), e o
painel de cada lado — o presente do Parceiro, em dois passos, com a cota em bolinhas; a carteira do
Profissional, que consulta a cada 15 s e mostra o aviso animado quando o presente chega. Antes da
janela, a tela diz a hora e abre sozinha; depois, `/sala/[id]/fim` mostra o encerramento (ou "você
saiu", com a volta, se a sala ainda está aberta). O botão "Entrar na sala" aparece no início e na
agenda dos dois lados só enquanto a porta está aberta. `entrar` confere participante e janela, grava
`room_name`, cria a sala e emite um token por chamada, com o redirecionamento de saída para a tela de
fim; o `close-sessions` pergunta ao Daily quem entrou e decide `done`/`no_show_*`. A falta tem nome
de acordo com quem olha, e o Parceiro corrige, na agenda dele, a do Profissional que a sala perdeu.
Tudo exercitado no `next dev` contra o `mentoria-dev` e o Daily de verdade: chamadas às rotas,
navegadores sem tela entrando na chamada, e as telas dirigidas por clique nos dois papéis.

Toda casca tem o **menu da conta** no pé da sidebar, com "Redefinir senha" e "Sair", e quem entra
com senha provisória recebe a janela de troca ao entrar (`components/conta/JanelaDeSenha.tsx`,
`trocarSenha` em `lib/auth/actions.ts`, regras puras em `lib/auth/senha.ts`).

735 testes em 43 arquivos — a marca da empresa em `marca/marca.test.ts` (paleta derivada,
legibilidade, ajuste fino, escrita e auditoria, conta pessoal recusada); a cor como token em `lib/cores.test.ts` (nenhum hex em componente,
`globals.css` igual a `variaveisDoTema(DEFAULT_THEME)`, tons derivados do accent); a recuperação de senha em `auth/recuperacao.test.ts`; o cadastro em `cadastro/fila.test.ts` (pedido e reenvio, aprovação
virando conta e dando papel no token, e-mail sem confirmar, recusa sem nome na auditoria, a rede da
rodada diária, anonimização de 90 dias) e `cadastro/regras.test.ts`; a conta pessoal em `ledger/conta-pessoal.test.ts` (dono único, tipo
imutável, CPF, crédito, idempotência, canais separados, lote no gasto e no estorno), RLS das tabelas
novas em `db/invariantes.test.ts` e `org_kind` em `auth/hook.test.ts`. Invariante 19 em
`src/lib/auth/hook.test.ts`; invariantes 3, 4, 7, 8, 9, 10 e 16 em `src/lib/db/invariantes.test.ts`;
as transações em `ledger/transacoes.test.ts`, `bookings/reserva.test.ts`,
`bookings/transicoes.test.ts` (com a presença), `bookings/presente.test.ts` e
`ledger/mensal.test.ts`, todas chamando as funções que a aplicação chama. As regras puras do vídeo em
`lib/video/*.test.ts`. Invariante 5 travada por `server-only` mais teste estático, agora com
`DAILY_*` na lista.


### Produção

No ar em `mentoria-bay.vercel.app` e completa desde 27/09/2026. O `mentoria` tem as dez
migrações até a A3 (`cadastro_anonimizado` em 07/10; `conta_individual` em 06/10; `senha_provisoria` em 29/09, conferida por consulta: as três contas
marcadas; `sala_e_presente` em 27/09, conferida por consulta: `fichas_used` e
`fichas_extra` na `org_usage`, colunas da extensão fora), as seis primeiras conferidas por consulta (27 tabelas com RLS, 37 policies, triggers dos
livros-caixa, `bookings_no_overlap`, `app_config`, hook, view `partner_professionals`); o hook está
ligado e a operadora `tostess` entrou pela tela. As seis variáveis estão nos três ambientes, com o recorte da invariante 17. Em produção há três
contas — a operadora, um Parceiro e um Profissional, criados em 27/09 —, todas com senha provisória
marcada; os dados de demonstração (Faculdade Aurora, Mariana Costa, Helena Braga)
existem só no `mentoria-dev`.

Operação, para não redescobrir:

- **Push na `main` publica em produção.** Migração nova vai para o `mentoria` por
  `db:migrate:prod` **antes** do push — a tela chega junto com o deploy, o esquema não.
- **`/api/health`** é o primeiro lugar a olhar quando um deploy não sobe.
- **Vercel pelo CLI** (`npx vercel`), já com login e com a pasta vinculada ao projeto. Trocar uma
  credencial de produção: painel → `.env.production.local` → `vercel env rm` + `vercel env add` →
  `vercel redeploy`. Entre o painel e o redeploy a produção fica sem banco.
- **Supabase pelo MCP** (`.mcp.json`, modo leitura) aparece a partir de uma sessão nova — lê os dois
  projetos; não configura autenticação nem migra.

### P4 — o que ficou de fora, de propósito

- **Badge de pedidos na navegação do Parceiro.** O número está em `/parceiro/inicio`; levar para a
  sidebar exige ler no layout, em paralelo com a página.
- **Busca em lote.** `primeiroHorarioDeCada` faz quatro leituras por Parceiro, em sequência (conexão
  `max: 1`). Folgado no piloto; perto de 200 Parceiros vira uma leitura só.
- **Nome de Parceiro pausado na agenda do Profissional.** A policy de `profiles` só abre Parceiro
  ativo; a sessão com quem pausou aparece com o termo no lugar do nome.
- **`next dev` com Turbopack não compila CSS no ambiente do Claude Code** (processo filho do PostCSS
  morre com `0xc0000142`). Para verificação local por HTTP ou Chrome headless, `next dev --webpack`.

### P5 — o que falta para o piloto

A P5 está em produção desde 27/09. Para o vídeo chegar ao piloto de 10/11:

1. ✅ **Teste do celular** no Preview da `p5` com o domínio `tostes` — o vídeo funcionou.
2. ✅ **Chave do Daily girada** em 28/09: a nova foi gerada no painel, entrou no `.env.local` e foi
   trocada nos três ambientes por *pipe* (`.claude/settings.local.json` libera `npx vercel env
   add/rm`), com redeploy da produção e do Preview da `p5`. Falta só apagar a antiga no Daily.
3. ✅ **Merge** em 27/09: `db:migrate:prod` antes do push, fast-forward da `p5` na `main`.
4. **Domínio Daily de produção**, com chave própria cadastrada só em Production (e `geo`
   `sa-east-1` no domínio). Depende do nome da plataforma. **Não bloqueia mais o piloto:** até lá a
   produção usa o `tostes` (decisão de 27/09). Na troca, é só substituir `DAILY_API_KEY` em
   Production e fazer o redeploy; salas antigas do `tostes` já terão expirado.

### A3 — o que ficou de fora, de propósito

- **Aviso por e-mail da aprovação e da recusa.** Sem Resend (A2): quem foi aprovado descobre
  entrando, e quem foi recusado descobre que o login não existe mais. A tela de confirmação não
  promete aviso.
- **Texto do e-mail de confirmação em português.** O modelo do Supabase Auth é configurado no
  painel e vem em inglês; entra com o SMTP próprio, na A2.
- **Captcha.** O campo-armadilha, a confirmação de e-mail e o limite do servidor de auth bastam
  no piloto. O limite é por IP e o `signUp` sai do servidor: todos os cadastros dividem o IP da
  Vercel — folgado para a escala do piloto, e o próprio SMTP limita antes.
- **Editar o pedido pela operadora** ou devolvê-lo com pergunta. Ela aprova, recusa ou espera.

### F4 — o que ficou de fora, de propósito

- **Upload do logotipo.** Endereço `https` digitado; Storage com bucket e policy fica para quando
  houver marca de verdade.
- **Marca da plataforma pela tela.** `app_config.branding` continua mudando no banco; o nome da
  plataforma ainda não existe.
- **Vocabulário por empresa.** `copy.terms` sobrescrevível por empresa é outra tela.
- **Entrada com a marca da empresa.** `/entrar` não sabe de que empresa a pessoa é antes de ela
  entrar; continua com a da plataforma.
- **O RH editar a própria marca.** É da operadora, como contrato — o console do RH é a F2.

### A1 — o que ficou de fora, de propósito

- **CPF.** A coluna e a unicidade existem; quem pede é o checkout, na primeira compra (A4).
- **Estorno de pacote (arrependimento) e baixa do vencimento.** Os lançamentos `reclaim`/`refund`
  do arrependimento e o `expire` da baixa diária chegam na A4 e na A5; o lote e a regra do gasto já
  estão aqui.
- **Pacote com valor diferente da tabela.** O registro manual grava o preço do pacote; desconto ou
  cortesia não têm campo.
- **Editar a tabela de pacotes pela tela.** Vive em `app_config.individual_packages`; muda-se no
  banco, por migração ou à mão no `mentoria-dev`.

### F3 — o que ficou de fora, de propósito

- **Vigência da rotina.** `effective_from`/`effective_to` existem e o motor as lê, mas a tela não as
  expõe: salvar a grade troca a semana a partir de agora. "A partir de novembro atendo à tarde" é,
  por enquanto, salvar em novembro.
- **Motivo da folga.** Ver a decisão: a coluna `reason` é legível por todo autenticado.
- **Folga e grade pela operadora.** `/admin/parceiros/[id]` não edita a agenda; o Parceiro é quem
  sabe dela.
- **Folga recorrente** ("toda primeira segunda do mês"). Faltaria regra no motor, que está travado.

### F7 — o que ficou de fora, de propósito

- **Fila de espera.** O horário cancelado volta à agenda e aparece para quem procurar; ninguém é
  avisado de que ele abriu.
- **Aviso ao outro lado.** Sem Resend não há e-mail: quem teve a sessão cancelada descobre pela
  agenda. A tela do Parceiro diz isso.
- **Motivo do cancelamento.** Nem o Profissional nem o Parceiro escrevem por quê; o esquema não tem
  coluna para isso, e a F6 (briefing) é o lugar natural para a conversa antes da sessão.
- **Cancelamento pela operadora.** Não há tela no admin; continua sendo operação à mão no banco.
- **"Cancelar" no início.** Só a agenda dos dois lados oferece; o início mostra a próxima sessão e
  leva à agenda.

### P5 — o que ficou de fora, de propósito

- **Webhook do Daily.** A presença vem de `/meetings` no fechamento; o esqueleto do webhook, a
  assinatura e os testes ficaram na branch `spike/video`, para quando houver uso em tempo real.
- **Cota do presente vinda de `app_config` na criação do Parceiro.** A coluna nasce com o default 3
  do esquema; mudar a política da plataforma não muda os Parceiros existentes.
- **Presente fora da sala.** Decisão de 27/09: só dentro. O Parceiro não tem como presentear depois,
  pela agenda.

O código do spike que não entrou morre com a branch `spike/video` — a lista está em
`docs/spike-video.md`, seção final.
