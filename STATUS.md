# STATUS

Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit final.

| Data | Etapa | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-25 | 5 + P2 | Motor de agenda em `src/lib/scheduling/` (faixas, dias, slots) — TypeScript puro, 103 testes, **travado**: regra semanal no fuso do Parceiro, exceções, descanso, teto semanal de domingo a sábado, aviso mínimo, horizonte e hora inexistente na virada do horário de verão; `avaliarSlots` devolve o motivo de cada recusa. P2: `/parceiro/disponibilidade` (modo rápido + prévia dos horários que o motor calcula + por que os outros não entraram) e `/parceiro/perfil` (dados, áreas, descanso, teto, confirmar sozinho), escrevendo **pela RLS** com a sessão do Parceiro; `lib/parceiro/` e helpers `inteiros`/`marcado` em `lib/forms`; 124 testes novos (286 no total) | Exceções (férias/bloqueio) o motor suporta mas a tela ainda não expõe — F3 | `c6af6a8` |
| 2026-09-25 | P1 | Painel do admin funcional: `/admin/painel` com números do livro-caixa e da view `org_usage`, `/admin/empresas` (lista + criar), `/admin/empresas/[id]` (contrato, colaboradores, alocação, livro-caixa) e `/admin/parceiros` (lista + criar Parceiro ativo); `lib/ledger` (compra e alocação transacionais, chaves de idempotência, tradução de erro do Postgres), `lib/pessoas` (empresa, Profissional, Parceiro com compensação da identidade), `lib/audit` (invariante 12), `lib/forms` (validação de borda); `Field`, `Table`, `ButtonLink` e `FormFeedback` no design system; `npm run seed:admin`; protótipo em `docs/prototipo-admin-p1.html`; 73 testes novos (162 no total); **hook ligado e fluxo inteiro percorrido pela interface** | Dados de demonstração ficaram no `mentoria-dev` e o livro-caixa não deixa apagar | `33a28bf` |
| 2026-09-18 | 4 | Hook `custom_access_token_hook` (invariante 19) e `app_config` com `copy` e `branding`; `src/proxy.ts` renovando sessão e roteando por papel; `lib/auth/` (claims, rotas, sessão, ações) e `lib/config/` (parse puro + carga no servidor); entrada real por Server Action, sair, `requireRole()` nos quatro layouts; vocabulário e marca vindos do banco, com sobrescrita por empresa; 49 testes novos (89 no total) | **Hook desligado no painel** — sem ativar, ninguém entra | `938cd0c` |
| 2026-09-10 | 3 | Esquema em `src/lib/db/schema/` (7 módulos, 27 tabelas); três migrações versionadas — prólogo, base gerada, epílogo; RLS nas 27 com 36 policies; `bookings_no_overlap`; triggers de saldo e imutabilidade; privilégio de coluna em `partners.status` e `profiles.role`; view `org_usage`; `app_config` semeada; 20 testes de invariante contra o Postgres, incluindo RLS exercitada como usuário logado | `org_admin` ainda não tem caminho de leitura além de `org_usage` — confirmar na Etapa 4 | `1e8b744` |
| 2026-09-10 | 2 | `.env.local.example`; `env.ts` público e `env.server.ts` com `server-only`; clientes `supabase/client`, `server` e `admin`; Drizzle sobre postgres.js com pool cacheado; `drizzle.config.ts` gerando em `supabase/migrations/` com prefixo `supabase`; `vercel.json` em `gru1`; `GET /api/health`; `npm run check:supabase`; teste estático da invariante 5 | — conexão verificada ponta a ponta contra `mentoria-dev` | `7b308da` |
| 2026-09-10 | 1 | Fontes via `next/font`; 11 componentes em `components/ui`; `theme.ts` com `resolveTheme`; `terms.ts`; shell com sidebar 246px e bloco de topo por papel; grupos `(auth)`, `(professional)`, `(partner)`, `(org)`, `(admin)` com 17 páginas vazias; `/design` só em dev com seletor de accent | Nome da plataforma é placeholder ("Mentoria") até `app_config` | `761d11d` |
| 2026-09-10 | 0 | Contrato migrado para Supabase; artefatos de Firebase removidos; `npm run build` verde | — | `27ff6d7` |

## Bloqueios abertos

- **Dados de demonstração no `mentoria-dev`, e eles não saem fácil.** O fluxo de verificação criou
  "Faculdade Aurora" (contrato de 120, accent `#2E6B52`), a profissional Mariana Costa com 2 fichas
  e a parceira Helena Braga. Apagar a empresa esbarra no `on delete restrict` do `org_ledger`, e o
  livro-caixa é imutável por trigger — remover exige desligar o gatilho como `postgres`. Não é
  defeito, é a invariante 3 funcionando; só não dá para "limpar o banco" sem intenção explícita.
  As senhas provisórias das duas contas foram descartadas com os arquivos temporários.

- ~~**Hook de access token desligado no painel do `mentoria-dev`.**~~ **Resolvido em 25/09/2026** —
  ligado no painel, conferido por entrada real com o token decodificado (`user_role: admin`). O
  `seed:admin` faz essa conferência sozinho a cada execução. Fica o registro do sintoma original:
  a mudança em Authentication → Hooks leva alguns segundos para o GoTrue propagar, e uma conferência
  feita logo depois do clique ainda acusa desligado.
- **Produção (`mentoria`) criada e vazia.** Ref `dtqylmvexaoybkdfzsna`, `sa-east-1`, pooler em
  `aws-0-sa-east-1.pooler.supabase.com` (determinado por sonda). As cinco migrações **ainda não
  foram aplicadas** lá, e o hook de access token também precisa ser ligado nesse projeto.
- **`drizzle.config.ts` não sabe migrar produção.** Ele carrega `.env.local` com `override: true`,
  então variável passada na linha de comando é ignorada. Migrar o `mentoria` exige um caminho
  explícito para o segundo ambiente antes de rodar `db:migrate`.
- **Variáveis ainda não cadastradas na Vercel.** Só existem em `.env.local`. Invariante 17:
  Production aponta para `mentoria`, Preview e Development para `mentoria-dev`.

## Decisões de sessão
_(dependência escolhida, atalho tomado, dívida assumida — o que não merece o CLAUDE.md)_

- **2026-09-25 (Etapa 5):** duas asserções minhas nasceram erradas por contar mal a janela de 14
  dias — uma sexta e um domingo a mais do que eu imaginava. O motor estava certo nas duas. Lição
  para o próximo teste de agenda: escrever a lista de datas da janela antes de escrever o número
  esperado.
- **2026-09-25 (Etapa 5):** o horizonte é inclusivo no instante exato — um horário que começa
  precisamente em `agora + 14 dias` entra. É `>` e não `>=` no motor, e tem teste próprio, porque é
  o tipo de ponta que alguém "corrige" sem perceber.
- **2026-09-25 (Etapa 5):** `instanteLocal` constrói a hora alvo direto em vez de somar minutos à
  meia-noite. A primeira versão somava, e teria recusado horários válidos em fusos cuja virada
  acontece à meia-noite — a própria base já nasceria deslocada.
- **2026-09-25 (P2):** `carregarPerfil` usa `Promise.all`, e isso **não** contraria a regra do
  travamento: aquelas consultas vão por HTTP ao PostgREST, não pela conexão Drizzle de `max: 1`. A
  regra vale para Drizzle; está comentado no arquivo para ninguém "consertar" depois.
- **2026-09-25 (P2):** salvar disponibilidade apaga e reinsere em duas idas ao banco, sem transação.
  O pior caso é o Parceiro ficar um instante sem regra nenhuma — o que não desmarca sessão nem
  perde dinheiro. Transação exigiria função no banco e o ganho não paga.
- **2026-09-25 (P2):** a tela não expõe exceções (férias, bloqueio pontual) embora o motor já as
  calcule e tenha teste para elas. Fica para a F3, junto da grade detalhada. Anotado porque "o motor
  suporta e a tela não mostra" é o tipo de coisa que se esquece.
- **2026-09-25 (P2, verificação):** um `next dev` antigo continuava rodando e recusou o novo
  (`run taskkill /PID …`). Como ele carregava a conexão entalada da sessão anterior, as telas do
  Parceiro pareciam travar — depois de matar e subir limpo, 1,1s. Antes de investigar lentidão em
  dev, conferir se há mais de um servidor de pé.
- **2026-09-25 (P2, verificação):** o Parceiro de teste do `mentoria-dev` teve a senha redefinida
  para `Parceiro!Teste2026` para eu conseguir exercitar as telas. Agora há dois Parceiros chamados
  "Helena Braga" no banco de desenvolvimento — um deles era o "teste" que você criou.

- **2026-09-25 (P1, verificação):** a conferência do hook feita segundos depois do clique no painel
  ainda acusou desligado; meia dúzia de minutos depois o mesmo token saiu com `user_role: admin`. É
  propagação do GoTrue, não erro de configuração. Se o `seed:admin` disser que está desligado logo
  após você ligar, rode de novo antes de investigar.
- **2026-09-25 (P1, verificação):** para exercitar a interface sem navegador, a sessão foi produzida
  chamando `createServerClient` da própria `@supabase/ssr` com um cofre de cookies em memória, e o
  cookie resultante foi replayado por `curl`. Vale lembrar para a próxima: imitar o formato do
  cookie à mão daria errado em silêncio; usar a mesma biblioteca não.
- **2026-09-25 (P1, verificação):** o primeiro POST de Server Action por `curl` invocou a ação
  **errada**. A página tem dois formulários e o primeiro é o "Sair" da sidebar — o
  `$ACTION_ID_…` solto pertence a ele, enquanto o formulário de `useActionState` usa
  `$ACTION_REF_n` + `$ACTION_n:0` + `$ACTION_n:1` + `$ACTION_KEY`. Resultado: eu me deslogava a cada
  tentativa e culpava a sessão. Escolher o formulário pelo campo que ele contém resolve.
- **2026-09-25 (P1, verificação):** `Origin` ausente faz o Next recusar a Server Action com
  `⚠ Missing origin header from a forwarded Server Actions request`. Só aparece no log do servidor —
  a resposta não diz nada.
- **2026-09-25 (P1, verificação):** `pg_stat_activity` foi o que desatou o diagnóstico do
  travamento. `state = active` há 17 minutos numa tabela vazia é a assinatura da conexão entalada;
  ler o log do Next sozinho levava para a conclusão errada, porque ele registra a requisição como
  `200` no instante em que o **cliente** desiste.
- **2026-09-25 (P1, verificação):** a primeira correção do travamento pareceu não funcionar porque a
  conexão entalada sobrevive ao HMR — ela mora no `globalThis`. Corrigir código e testar sem
  reiniciar o `next dev` mede o servidor antigo.
- **2026-09-25 (P1, verificação):** pasta `src/app/api/_diag` não vira rota — prefixo `_` é pasta
  privada no App Router. Custou um 404 confuso no meio da depuração.

- **2026-09-25 (P1):** o `mentoria-dev` respondeu "tenant/user não encontrado" no pooler nas
  primeiras tentativas e voltou sozinho — é **cold start**, não região errada nem projeto pausado.
  Probei os 15 hosts de pooler de 7 regiões: só `aws-0-sa-east-1` registra o tenant, e o
  `db.<ref>.supabase.co` direto estoura timeout (IPv6). O `.env.local` já estava certo; a lição é
  que a primeira falha de conexão do dia não significa nada.
- **2026-09-25 (P1):** o PostgREST devolveu `PGRST205 — could not find the table 'public.app_config'`
  na primeira consulta e acertou na segunda. É cache de esquema frio, não esquema faltando. Vale
  saber antes de sair investigando migração.
- **2026-09-25 (P1):** hook reconferido por comportamento, não por documentação — criei usuário pela
  API de admin, entrei com senha e decodifiquei o JWT. Voltou só
  `aal, amr, app_metadata, aud, email, exp, iat, is_anonymous, iss, phone, role, session_id, sub,
  user_metadata`: **sem `user_role`**. Essa conferência virou parte do `seed:admin`, porque é o
  único erro do projeto que não produz mensagem nenhuma em lugar nenhum.
- **2026-09-25 (P1):** existe um plano B se o gancho do painel virar problema — aceitar
  `app_metadata.user_role` como origem alternativa em `parseClaims()`, já que `app_metadata` também
  só é escrito por `service_role` e também viaja no JWT. **Não** foi feito: duplicaria a fonte da
  verdade da invariante 19 para poupar um clique.
- **2026-09-25 (P1):** `audit.ts`, `ledger/operacoes.ts` e `pessoas/operacoes.ts` **não** levam
  `server-only`. Nenhum lê segredo ou abre conexão — recebem a transação de quem já a tem. Marcá-los
  travaria o teste que exercita a auditoria junto da operação sem proteger nada que `lib/db` e
  `lib/supabase/admin` já não protejam. O teste estático ganhou os três módulos que **sim** precisam
  do selo: `lib/ledger/index.ts`, `lib/pessoas/criar.ts`, `lib/admin/consultas.ts`.
- **2026-09-25 (P1):** `lib/admin/acoes.ts` ficou fora da lista de módulos proibidos ao cliente, de
  propósito: é `"use server"` e componente cliente **tem** de importá-lo — o que cruza a fronteira é
  uma referência de ação, não o código. Anotado no próprio teste para ninguém "consertar" depois.
- **2026-09-25 (P1):** o primeiro teste de "crédito que falha desfaz o débito" estava furado. Ele
  apagava a carteira, mas a alocação tranca a carteira **antes** de debitar, então falhava cedo e as
  asserções passavam pelo motivo errado. A versão que vale ocupa antes a `idempotency_key` que o
  `wallet_ledger` vai usar: o débito no `org_ledger` passa, o crédito bate na unicidade, e o que
  sobra mede a invariante 6 de verdade.
- **2026-09-25 (P1):** `criar empresa` não tem chave de idempotência. Duplo clique cria duas
  empresas — o botão desabilita durante o envio e a ação redireciona para a tela da empresa criada,
  o que torna a duplicata visível na hora. Dívida consciente: não vale um token onde não há dinheiro
  envolvido, e `orgs.name` não é único de propósito (duas unidades podem ter o mesmo nome).
- **2026-09-25 (P1):** `PageHeader.eyebrow` passou de `string` para `ReactNode`, para a trilha de
  migalhas da tela de empresa caber lá com link.
- **2026-09-25 (P1):** `ButtonLink` nasceu porque o painel precisava de botão que navega. Duplica as
  classes de `Button` — as duas têm de mudar juntas. A alternativa (um `<button>` com
  `router.push`) perderia meio-clique, nova aba e endereço na barra de status.
- **2026-09-25 (P1):** a faixa de cor da taxa de utilização (verde >=70%, ouro 40-70, vermelho <40)
  é chute informado e está no componente, não em `app_config`. Quando alguém souber qual é o número
  bom, a decisão muda de lugar.
- **2026-09-25 (P1):** conta de operadora criada no `mentoria-dev` —
  `jpferreiratostes@gmail.com`, `user_id f09749ae-9944-4c49-a639-9f67eecd0a43`, senha provisória
  `Mentoria!Piloto2026`. Trocar depois de o hook ligar.

- **2026-09-18 (Etapa 4):** o `mentoria-dev` estava fora do ar no começo da sessão — gateway
  devolvendo 521 e o pooler dizendo "tenant not found" nas duas regiões, sintoma de projeto
  pausado. Voltou sozinho durante a sessão. A sonda de região do `check:supabase` não distingue
  pausado de região errada, e o check deu **verde falso** em "Supabase Auth (publishable)": ele
  aceita qualquer erro que não seja de sessão, e um 521 passou. Vale apertar quando sobrar tempo.
- **2026-09-18 (produção criada):** o projeto `mentoria` nasceu com **chave de assinatura
  assimétrica (ES256)**, confirmado pelo `jwks.json`. É o caminho bom para a Etapa 4: o
  `getClaims()` verifica o token localmente com WebCrypto, sem uma ida à rede por requisição.
  O `mentoria-dev` está no mesmo esquema (conferido pelo `jwks.json` dos dois), então dev e
  produção se comportam igual — se um estivesse em segredo simétrico, cada `getClaims()` viraria
  chamada ao servidor de auth e só um dos dois ambientes mostraria a latência.
- **2026-09-18 (Etapa 4):** confirmada a pendência aberta na Etapa 3 — o `org_admin` continua sem
  caminho de leitura além de `org_usage`, e isso é a invariante 10, não lacuna. A Etapa 4 estendeu
  a regra para a rota: `canAccess('org_admin', '/agenda')` é false, coberto por teste. Quando o
  console do RH chegar (F2), ele lê agregado; nunca `bookings`.
- **2026-09-18 (Etapa 4):** `getClaims()` no lugar de `getUser()`. As claims que importam
  (`user_role`, `org_id`) são customizadas e não aparecem no objeto de usuário — `getUser()`
  obrigaria a reler `profiles` a cada requisição, que é exatamente o que a invariante 19 proíbe.
- **2026-09-18 (Etapa 4):** o build quebrou antes de existir `force-dynamic` no layout raiz: o
  Next tentava pré-renderizar as cascas, cada worker abria conexão com o Postgres e estourava 60s
  por página. A correção não é timeout, é dizer a verdade — nada aqui é estático.
- **2026-09-18 (Etapa 4):** o proxy **fecha** quando falta variável do Supabase, em vez de deixar
  passar. Deploy com variável faltando não pode virar aplicação sem porta; a tela de entrada
  continua de pé e o erro aparece lá.
- **2026-09-18 (Etapa 4):** `parseClaims()` recusa token cujo `org_id` não combina com o papel
  (invariante 9). Token coerente não tem como chegar assim — o `check` de `profiles` impede a
  linha que o geraria — então chegar significa token forjado, e a resposta é não.
- **2026-09-18 (Etapa 4):** o teste do hook nasceu medindo a si mesmo. Passando o evento com
  `JSON.stringify`, o postgres.js infere o tipo pelo `::jsonb` do SQL e serializa a string **como**
  jsonb, produzindo um jsonb string em vez de objeto: o hook não achava `user_id` e devolvia o
  evento intacto, e 9 dos 12 casos falhavam por motivo errado. Vai por `tx.json()`.
- **2026-09-18 (Etapa 4):** o caso "roda como `supabase_auth_admin`" não dá para exercitar — o
  `postgres` não é membro desse papel e `set role` é negado. Virou asserção de privilégio via
  `has_function_privilege` / `has_table_privilege` mais a policy conferida por existir, ser
  permissiva e valer para o papel. É mais fraco que comportamento, e está anotado como tal.
  Conferido por mutação que a asserção discrimina: para `authenticated` e `anon` dá false.
- **2026-09-18 (Etapa 4):** `anon` tem `select` de tabela em `public.profiles` (grant default do
  Supabase, herdado da Etapa 3). Não é furo: sem policy que case, a RLS devolve zero linhas —
  verificado por consulta com `set local role anon`.
- **2026-09-18 (Etapa 4):** `revoke execute` no hook pegou `public`, `anon` e `authenticated`, mas
  `service_role` e `postgres` continuam com EXECUTE. Não acrescenta poder — os dois já leem
  `profiles` inteira sem passar por função nenhuma. O comentário da migração diz "só o servidor de
  auth", o que é impreciso para esses dois; o arquivo não foi editado porque já está aplicado e
  tem hash no journal.
- **2026-09-18 (Etapa 4):** botão de entrar com Google saiu da tela. No piloto a conta é criada
  pelo admin, o Parceiro entra por convite (invariante 8) e não há self-service — o botão
  desabilitado prometia um caminho que não existe.
- **2026-09-18 (Etapa 4):** `platformName` saiu de `Terms` e foi para `branding`. É marca, não
  vocabulário, e estava duplicado com o nome que o tema já resolvia.
- **2026-09-18 (Etapa 4):** removido o export estático `terms`; as 16 páginas de esqueleto viraram
  Server Components que chamam `loadTerms()`, e `Ficha`/`Price` viraram componentes de cliente com
  `useTerms()`. Um teste de varredura impede o export voltar e impede tela importar `DEFAULT_TERMS`.
- **2026-09-18 (Etapa 4):** o índice de cascas em `/` morreu, e com ele o link "Trocar de casca" da
  sidebar. Trocar de casca deixou de existir quando o papel passou a vir do JWT.

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
