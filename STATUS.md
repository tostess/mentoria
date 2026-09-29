# STATUS

Uma linha por sessão, mais recente no topo. Atualizar **antes** do commit final.

| Data | Etapa | O que foi feito | Pendências | Commit |
|---|---|---|---|---|
| 2026-09-28 | Conta: menu e senha provisória | Pedido seu, antes da próxima fase. Menu da conta no pé da sidebar das quatro cascas (`MenuDaConta`: "Redefinir senha" e "Sair", Esc e clique fora fecham, bolinha dourada enquanto a senha for provisória); janela de troca (`JanelaDeSenha`, `<dialog>` por portal) que abre sozinha ao entrar com senha provisória, com "Agora não"; `trocarSenha` confere a atual por cliente avulso, troca pela sessão da pessoa, tira a marca e renova o token. Marca em `app_metadata.senha_provisoria`, lida do JWT (`Session.senhaProvisoria`); criação e senha nova pelo admin marcam, `seed:admin` marca quando sorteia; migração `senha_provisoria` marca todas as contas existentes — aplicada no `mentoria-dev` (as 4 marcadas). Fluxo medido contra o auth do `mentoria-dev` com conta temporária, e dirigido por clique no `next dev --webpack` com Chrome sem tela: entrada, erro de confirmação, senha atual errada, troca, recarga sem aviso, menu, Esc, senha nova pelo admin fazendo o aviso voltar, celular 390px, sem erro de console; conta temporária apagada. Ícone `chevron-up`; `lib/auth/conta` na cerca da invariante 5; 12 testes novos (535 no total) | **`db:migrate:prod` antes do merge** — a operadora `tostess` vai receber o aviso na próxima entrada; merge da `conta` na `main` | — |
| 2026-09-28 | Giro da chave do Daily | Chave nova gerada por você e posta no `.env.local`; conferida sem aparecer (diferente da da Vercel, 200 no domínio `tostes`). Regra em `.claude/settings.local.json` liberando `npx vercel env add/rm` (o modo automático barrava gravação de segredo); trocada em Production e Preview (*sensitive*) e Development, com Development conferida contra o `.env.local`; redeploy da produção e do Preview da `p5`, `/api/health` ok | Apagar a chave antiga no painel do Daily e conferir que ela passa a ser recusada | — |
| 2026-09-27 | Vídeo em produção | Decisão sua: produção usa o domínio de teste `tostes` até o domínio próprio existir. `DAILY_API_KEY` passada por *pipe* do `.env.local` para Production (*sensitive*), sem passar pelo chat; redeploy `Ready`, `mentoria-bay` apontando para ele. Nenhuma trava no código impedia; o `geo: sa-east-1` já vai por sala. Exceção registrada em "Um domínio Daily por ambiente" | Girar a chave do Daily (agora nos três ambientes); teste ponta a ponta em produção exige Profissional e Parceiro reais lá; domínio próprio quando o nome sair | — |
| 2026-09-27 | P5 em produção | Vídeo aprovado no celular pelo Preview. Conferido antes: nenhuma leitura de linha inteira em `bookings`/`partners`/`gift_quotas` na `main`, então migrar antes do deploy não quebrava a P4 no ar; `tsc` limpo e 523 testes. `db:check:prod` e `db:migrate:prod` (ref `dtqylmvexaoybkdfzsna` anunciado) aplicaram `sala_e_presente`, conferida pelo MCP (7 migrações, `fichas_used`/`fichas_extra`, colunas da extensão fora, chave fora de `ficha_policy`); fast-forward da `p5` na `main` e push; deploy `Ready`, `/api/health` ok, `/api/sessoes/[id]/entrar` 401 sem sessão, cron 401 | Domínio Daily de produção (sem ele a sala diz "vídeo não configurado" e o `close-sessions` segue a regra da P4); girar a chave do Daily | `e5d0422` |
| 2026-09-28 | P5 (parte 2) | Protótipo aprovado. Sala `/sala/[id]` dos dois papéis, fora da casca (grupo `(sala)`, `/sala` na tabela de acesso): `SalaAoVivo` com iframe, relógio pelo relógio do servidor (`lib/video/relogio.ts`, puro), painel do presente em dois passos com a cota, carteira do Profissional com consulta de 15 s (`GET /api/sessoes/[id]/presente`) e aviso animado — a única animação, em `globals.css`, com "reduzir movimento"; tela de espera com contagem que abre sozinha; `/sala/[id]/fim` (encerrada ou "você saiu", com a volta) com `SairDoIframe`; token com `redirect_on_meeting_exit` para a tela de fim, origem da requisição. "Entrar na sala" no início e na agenda dos dois lados (`botaoDaSala`, a mesma `porta` da rota) e "a sala abre às…". Falta com nome pelo lado de quem olha; linha do presente na agenda dos dois. Correção de presença (`correcaoDePresencaNaTransacao` + `POST /api/sessoes/[id]/presenca` + `corrigir_presenca` no catálogo), marcando as duas presenças e auditando. Ícones `presente` e `video`; `nomeDoMes`. Tudo dirigido por clique no `next dev` com Chrome sem tela nos dois papéis; 18 testes novos (523 no total) | Teste do celular e giro da chave do Daily com você; `db:migrate:prod` antes do merge; domínio Daily de produção (depende do nome) | — |
| 2026-09-27/28 | P5 (parte 1) | Estado real conferido: a P4 já estava na `main`, publicada e com a migração no `mentoria`. Branch `p5`. **Decisões fechadas com você: a extensão saiu** — o gesto do Parceiro na sala é presentear 1 ficha (só na sala, 1 por sessão, fora do teto e do contrato); expulsão em fim + 5; presença por `/meetings`; um domínio Daily por ambiente; mídia em São Paulo; iframe. Invariantes 7, 18 e 20 reescritas. Protótipo `docs/prototipo-p5.html`. Migração `sala_e_presente` (tira a extensão do esquema; `org_usage` com `fichas_used` e `fichas_extra`) aplicada no `mentoria-dev`; `lib/video/` (cliente do Daily do spike, `sala.ts`, `presenca.ts`, `entrada.ts`); `bookings/presente.ts`; `close-sessions` decidindo `done`/`no_show_*` pela sala, com estorno e compensação; `POST /api/sessoes/[id]/entrar` e `/presentear`; `DAILY_*` na cerca da invariante 5. **Defeito da P4 achado e corrigido:** estorno contava como ficha usada no painel e em `/fichas` (Aurora: 86% → 43%). `redirect_on_meeting_exit` medido (§6 do spike). 51 testes novos (505 no total) | **Protótipo aguardando aprovação**; telas da sala; correção de presença; `db:migrate:prod` antes do merge; teste do celular e giro da chave do Daily com você | — |
| 2026-09-27 | P4 (parte 2) | Protótipo aprovado. Migração `perfil_para_parceiro`: view `partner_professionals` (nome, foto, cargo, área e empresa de quem marcou com o Parceiro — sem e-mail, telefone nem dado do contrato), aplicada no `mentoria-dev`, com 4 testes de comportamento como usuário; `avaliarAgenda` compartilhada entre tela e reserva, com teste de que todo horário oferecido é aceito; `horariosLivres` e `primeiroHorarioDeCada`; formatação de agenda por fuso em `lib/formato.ts`; rótulos de status tipados pelo enum; `separarAgenda` e `limiteDeResposta`; `POST /api/bookings/:id/confirmar` e `/recusar`; telas `/inicio`, `/parceiros`, `/parceiros/[id]`, `/agenda`, `/parceiro/inicio`, `/parceiro/sessoes`; ícones `alerta`, `info`, `fuso`, `chevron-left`; 28 testes novos (454 no total). Verificado no `next dev --webpack` contra o `mentoria-dev`: reserva, 401/403/404/409, recusa com estorno, confirmação, e cliques reais em Chrome headless por CDP (agendar, recusar em dois passos, corrida com 409, celular 390px) sem erro de console | **`db:migrate:prod` antes do merge**; merge na `main` publica telas e crons | — |
| 2026-09-27 | P4 (parte 1) | Branch `p4` a partir da `main`, com o commit de documentação do spike (roteiro da P5 e `docs/spike-video.md`) trazido por *cherry-pick* — o código do laboratório ficou na `spike/video`. As quatro decisões fechadas pela recomendação (recusa estorna, `close-sessions` marca `done` até a P5, estorno com chave única `refund_{bookingId}`, `send-reminders` para depois da P5) e a máquina de estados ganhou a aresta da recusa; protótipo `docs/prototipo-p4.html` (início e agenda do Profissional, busca, página do Parceiro com horários e confirmação, início e sessões do Parceiro, celular); `estornoNaTransacao` + `chaveEstorno`; `lib/bookings/transicoes.ts` (confirmar, recusar, expirar, fechar, rodadas por sessão); `/api/cron/expire-pending` e `/api/cron/close-sessions` no `vercel.json`, exercitados no `next dev` contra o `mentoria-dev` (200 com segredo, 401 sem); 22 testes novos (426 no total) | **Protótipo aguardando aprovação**, com a pergunta "o Parceiro vê cargo e empresa de quem pediu?"; telas e Route Handlers de confirmar/recusar; os crons novos só chegam à Vercel com o merge | — |
| 2026-09-27 | P5-0 (spike) | **Branch `spike/video`, sem merge.** Vídeo medido com Chrome headless por CDP (sem dependência nova) contra o Daily: criação concorrente (uma 200, demais 400 `invalid-request-error` igual a nome inválido → `garantirSala` confirma por `GET`, com teste); `nbf`/`exp` do token só controlam entrada, permanência é `eject_at_*`; **extensão pelo `exp` da sala refutada** — a expulsão é fixada na entrada de cada pessoa — e fim pelo servidor (`/eject` por `user_ids`) medido em 1–2 s; aviso do Prebuilt só nos últimos 5 min; `/meetings` dá presença exata sem webhook; `canExtend`: com descanso 15 a constraint não recusa a extensão (`tstzrange` semiaberto), o descanso é que se viola. Lab em `/lab/video` e `/api/lab/video/*`, 404 com `VERCEL_ENV=production`, cerca estática em `_lib/lab.test.ts`; rota de webhook com assinatura HMAC (503/401/200 exercitados localmente); `DAILY_API_KEY` e `DAILY_WEBHOOK_SECRET` em Preview (*sensitive*) e Development; `docs/spike-video.md`; roteiro da P5 no CLAUDE.md com 7 decisões; 26 testes novos (430 no total) | Teste no celular (roteiro no doc, §5); webhook adiado — falta bypass da proteção do Preview; decisões da P5 em aberto; chave do Daily foi colada no chat — girar depois do spike; P4 continua sendo a próxima feature | `spike/video` |
| 2026-09-27 | Produção | Seis variáveis na Vercel nos três ambientes pelo CLI (`npx vercel`, valores por *pipe* do arquivo, segredos *sensitive*), com o recorte da invariante 17; `CRON_SECRET` de produção sorteado direto para a Vercel; chave pública de produção conferida contra os dois projetos; `.env.production.local` criado (pooler `aws-0` confirmado por sonda); `db:migrate:prod` aplicou as cinco migrações no `mentoria` e a conferência por consulta bateu (27 tabelas com RLS, 37 policies, triggers, exclusão, `app_config`, hook); redeploy — o primeiro, sem cache, falhou em `next/font/google`, o segundo subiu; `/api/health` `ok: true`, cron 401; `seed:admin:prod` com `--producao` e anúncio do ref; `.mcp.json` com Supabase em modo leitura e Vercel (MCP da Vercel não conecta — ver CLAUDE.md); preparação da P4 no CLAUDE.md | Hook ligado, senha trocada e operadora `tostess` criada e **entrando pela tela** — produção completa; `seed:admin` passou a conferir o hook também com senha sorteada; roteiro da P4 no CLAUDE.md, começando pelas quatro decisões | `409005e` |
| 2026-09-26 | P3 | Carteira do Profissional em `/fichas` (saldo, extrato, o que a ficha vale) lida pela sessão dele via PostgREST, e saldo real na sidebar — fim dos números de exemplo em todas as cascas; `allocate-monthly` (`lib/ledger/mensal.ts` + `/api/cron/allocate-monthly` + `crons` no `vercel.json`), uma transação por pessoa, soma parcial até o teto, idempotente por `alloc_{userId}_{YYYYMM}`, com guarda de `CRON_SECRET` em tempo constante; `POST /api/bookings` transacional (`lib/bookings/`) recalculando a agenda no motor antes de escrever, travando a carteira, traduzindo `23P01` em frase; `lib/config/limites.ts` unificando a tradução de `app_config` para o motor; `paraInstante()` em `lib/db/instantes.ts`; `audit.ts` aceitando autor nulo; cenário de teste compartilhado com cerca estática; 44 testes novos (404 no total) | Nenhuma tela chama o endpoint de reserva ainda — é a P4; `CRON_SECRET` não está na Vercel | `6718144` |
| 2026-09-25 | Polimento | **Exceção pedida à regra de uma feature por sessão.** `lucide-react` com mapa de ícones por nome (`components/ui/icones.ts`) na navegação dos quatro papéis, cards, números e estados vazios; catálogo tipado de ações auditadas (`lib/admin/atividade.ts`) — o painel e a nova `/admin/atividade` mostram frase com ícone e tempo relativo em vez de `alocar_fichas`; livro-caixa em português; edição de Parceiro (`/admin/parceiros/[id]`: dados, e-mail com login, status pausar/arquivar/reativar) e de Profissional (`/admin/empresas/[id]/pessoas/[userId]`: dados, desativar/reativar acesso, atalho de alocação), senha provisória nova com botão de copiar, confirmação em dois passos, histórico por pessoa; busca e filtro nas listas com linha clicável; sidebar vira barra com menu no celular; migalhas, `loading` e `not-found` do admin, título da aba por tela; fim dos números fixos na sidebar do admin; `lib/pessoas/edicao.ts` + `editar.ts`, `lib/formato.ts`; protótipo em `docs/prototipo-polimento.html`; 74 testes novos (360 no total), incluindo varredura de `snake_case` no JSX; fluxos de e-mail, senha e acesso exercitados contra o servidor de auth do `mentoria-dev` | Telas do Profissional e do RH ainda são esqueleto com número de exemplo na sidebar (P3/F2); editar empresa ficou fora | `157b8ed` |
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
- ~~**Produção (`mentoria`) criada e vazia.**~~ **Migrada em 27/09/2026** — as cinco migrações
  aplicadas por `db:migrate:prod` e conferidas por consulta. Ref `dtqylmvexaoybkdfzsna`,
  `sa-east-1`, pooler em `aws-0-sa-east-1.pooler.supabase.com` (o `aws-1` responde "tenant not
  found"). Hook ligado no painel e operadora `tostess` criada no mesmo dia; a entrada pela tela
  confirmou o `user_role` no token.
- ~~**Senha do banco `mentoria` exposta.**~~ **Trocada em 27/09/2026**, e propagada para o arquivo
  e para a Vercel com redeploy. Registro original: foi escrita em texto numa conversa em 27/09/2026 para
  montar o `.env.production.local`. Trocar no painel e reescrever `DATABASE_URL`/`DIRECT_URL` no
  arquivo e na Vercel (Production), seguido de redeploy.
- ~~**`drizzle.config.ts` não sabe migrar produção.**~~ **Resolvido em 26/09/2026** — um arquivo por
  ambiente, escolhido por `DRIZZLE_ENV`: `.env.local` no desenvolvimento e `.env.production.local` na
  produção, com `npm run db:migrate:prod` e `db:check:prod`. Tirar o `override` teria sido pior:
  com precedência de shell, um `DIRECT_URL` esquecido no terminal migra o banco errado sem avisar.
  Agora tocar produção exige **duas** decisões explícitas — criar o arquivo e passar o ambiente — e o
  config anuncia host e ref antes de agir. Sem o arquivo, `db:check:prod` instrui em vez de migrar o
  dev calado (conferido).
- ~~**Variáveis ainda não cadastradas na Vercel.**~~ **Resolvido em 27/09/2026** — as seis nos três
  ambientes, e o redeploy feito. Registro original: só existiam em `.env.local`. Invariante 17:
  Production aponta para `mentoria`, Preview e Development para `mentoria-dev`. **Confirmado pelo
  primeiro deploy (26/09):** sem elas todas as rotas davam 500; agora a tela de entrada sobe e diz o
  que falta, mas o ambiente continua sem funcionar até serem cadastradas **e o deploy refeito** —
  `NEXT_PUBLIC_*` é embutida no build.

## Decisões de sessão
_(dependência escolhida, atalho tomado, dívida assumida — o que não merece o CLAUDE.md)_

- **2026-09-28 (P5, teste no celular):** Preview da branch `p5` em
  `mentoria-git-p5-tostess-projects.vercel.app` (push da `p5` para o GitHub; produção intocada).
  Para o teste foi criada no `mentoria-dev` uma sessão nova Mariana × Helena, confirmada, **27/09
  23h26–23h56** (`60ff5c76…`, `created_via = 'teste-celular'`), gravada à mão como a reserva grava —
  booking e `spend_{id}` na mesma transação —, porque o aviso mínimo de 12 h impede marcar para agora
  pela tela. Mariana ficou com 5 fichas. A sessão de demonstração de 29/09 às 9h não foi tocada.
- **2026-09-28 (P5 parte 2, verificação):** a sessão da Mariana com a Helena de **01/10 também
  deixou de existir nessa data**: virou a sessão de verificação das telas — trazida para 27/09 às 23h,
  presente dado pela tela (Mariana chegou a 6 fichas, o teto; `gift_quotas` da Helena em 202609 com
  2 usados), fechada como `no_show_professional` (ninguém clicou em "Entrar" dentro do Prebuilt) e
  corrigida pela tela da Helena. Ficou realizada em 27/09, 22h15–22h45. Das sessões de demonstração,
  resta confirmada só a de **29/09 às 9h**.
- **2026-09-28 (P5 parte 2, verificação):** a correção foi feita **duas vezes** nessa sessão: a
  primeira com o código que ainda não marcava a presença do Parceiro. Ela foi desfeita à mão
  (status de volta para `no_show_professional` e `session_count` da Helena − 1) e refeita pela tela
  com o código novo. As duas linhas de `corrigir_presenca` ficam em `audit_logs` — imutável —, a
  primeira com `after.presenca` e a segunda com `presenca_profissional`/`presenca_parceiro`. O feed
  descreve as duas igual.
- **2026-09-28 (P5 parte 2):** o `next dev` registra "The destination stream closed early" quando o
  Chrome da verificação é fechado no meio de uma resposta. Não é defeito da aplicação.
- **2026-09-28 (P5 parte 2):** a primeira navegação para `/sala/[id]/fim` no `next dev` leva ~5 s
  (compilação da rota), e o endereço só muda quando a página nova chega. A primeira tentativa da
  verificação leu isso como "o Sair não funciona"; com espera, funciona.

- **2026-09-28 (P5, verificação):** a sessão confirmada da Mariana com a Helena de **08/10 deixou de
  existir nessa data**: foi trazida para 27/09 às 22h para exercitar as rotas, ganhou o presente
  (Mariana +1 ficha, `gift` no livro-caixa; `gift_quotas` da Helena em 202609 com 1 usado), recebeu
  dois navegadores sem tela na sala e foi fechada pelo `close-sessions` como `done`, com as duas
  presenças e quatro linhas em `session_events`. Ficou registrada como realizada em 27/09,
  21h51–22h21. A sala `8b0d1622…` no Daily expirou sozinha.
- **2026-09-28 (P5, verificação):** os navegadores sem tela entraram com um **token de medição**
  emitido à parte — mesmo `user_id`, sem a tela de teste de câmera —, porque o token da rota liga
  `enable_prejoin_ui` e navegador sem tela não clica em "Participar". A sala e o token da rota foram
  conferidos pelo que o Daily devolve (`GET /rooms` e o conteúdo do JWT), e a presença pela leitura
  real do `close-sessions`.
- **2026-09-28 (P5):** `/meetings` de reunião derrubada à força continua `ongoing: true` por alguns
  minutos, com a duração até a última notícia. Não afeta o fechamento, que roda 15 min depois do fim
  e 10 min depois de a sala expulsar todo mundo.
- **2026-09-28 (P5):** `redirect_on_meeting_exit` foi medido com salas `lab-redirect-*`, apagadas no
  fim de cada rodada. Um dos tokens de medição apareceu na saída do terminal — de uma sala que não
  chegou a existir; não abre nada.
- **2026-09-28 (P5):** a cota de presente do mês é conferida contra `partners.gift_quota_monthly`,
  não contra `app_config`. Quem cria Parceiro não lê `app_config` para preencher a coluna (nasce com o
  default 3 do esquema); se a política da plataforma mudar, os Parceiros existentes não mudam junto.
  Dívida pequena, anotada.

- **2026-09-27 (P4, verificação):** o `next dev` com Turbopack devolveu 500 em toda tela: o processo
  filho do PostCSS morre com `0xc0000142` no ambiente do Claude Code (as rotas de API passavam
  porque não compilam CSS). `next dev --webpack` roda o PostCSS no mesmo processo e resolveu. Um
  `next dev` anterior tinha ficado órfão na 3100 depois do `TaskStop` — o `TaskStop` mata o shell, não
  o Next; conferir a porta antes de subir outro.
- **2026-09-27 (P4, verificação):** no `mentoria-dev` a Mariana ganhou uma sessão confirmada com a
  Helena em 08/10 às 9h (saldo 4) e três pedidos recusados, com estorno, de 06/10. O `auto_confirm` da
  Helena foi desligado durante o teste para exercitar pedido pendente e religado no fim.
- **2026-09-27 (P4):** a Helena do `mentoria-dev` tem teto de 2 por semana; com as duas sessões de
  29/09 e 01/10, a primeira semana dela aparece sem horário. Não é defeito — é o motor.
- **2026-09-27 (P4):** o motivo do estorno vai para `wallet_ledger.reason` como frase ("Pedido
  recusado", "Pedido expirou sem resposta") porque é o que o extrato de `/fichas` mostra. Escrita sem
  "Parceiro" de propósito: texto gravado no banco não passa por `terms`.
- **2026-09-27 (P4):** `close-sessions` passou a incrementar `partners.session_count` na mesma
  transação do `done`. A coluna existia desde a Etapa 3 e ninguém a escrevia.
- **2026-09-27 (P4):** os testes das rodadas enxergam o banco inteiro, inclusive as sessões de
  demonstração do `mentoria-dev`; as asserções olham a sessão do teste pelo id, nunca a contagem.
  Os testes de expiração reescrevem `created_at`, que nasce do relógio real do banco.
- **2026-09-27 (P4, verificação):** os crons foram exercitados com `next dev` e não com `next build`
  porque o `.env.production.local` está na máquina — o build local escreveria em produção.

- **2026-09-26 (primeiro deploy):** o deploy do commit `c128d2b` subiu e **toda** rota devolveu 500
  (`ERROR 3150590241` na tela da Vercel). Causa: sem as variáveis do Supabase no projeto, o layout
  raiz estourava em `getSession()` → `createClient()`. Reproduzido localmente movendo o `.env.local`
  e servindo o build com `next start`; corrigido com guarda em `getSession()` e tela de ambiente
  incompleto em `/entrar`, e reconferido no mesmo runtime — `/` dá 307, `/entrar` dá 200 nomeando as
  variáveis, e `/api/health` responde `{"supabaseUrl":false,...}`. O `.env.local` foi copiado para o
  scratchpad antes e conferido byte a byte depois.
- **2026-09-26 (primeiro deploy):** `/api/health` provou o valor que justificava sua existência — é a
  única rota que responde com tudo quebrado, porque Route Handler não passa pelo layout raiz nem
  pelo proxy. Primeiro lugar a olhar em deploy que não sobe.

- **2026-09-26 (P3):** de novo um defeito que só aparece rodando. Interpolar `Date` no template do
  postgres.js passa em Node e estoura no bundle do Next (`ERR_INVALID_ARG_TYPE: Received an instance
  of Date`) — a mesma assimetria do `tx.json()`, o mesmo sintoma de 500 sem pista, e os 404 testes
  verdes enquanto toda reserva falhava. Virou `paraInstante()` com `::text::timestamptz`. **É a
  segunda vez**: vale tratar "o teste roda em Node, a aplicação roda no bundle" como regra de
  desconfiança, não como curiosidade.
- **2026-09-26 (P3):** não dá para travar essa família de armadilha por teste, porque o teste roda no
  ambiente que funciona. O `tx.json()` virou varredura de código; `Date` não dá — não é detectável
  por regex de forma confiável. A proteção real passou a ser exercitar o endpoint no Next durante a
  verificação, e está anotado como tal.
- **2026-09-26 (P3):** `alocacaoNaTransacao` mudou de assinatura — recebe `chave` pronta em vez de
  `token`, e `ator` pode ser nulo. Os sete pontos de chamada nos testes foram ajustados pelo próprio
  compilador, que apontou todos.
- **2026-09-26 (P3):** a segunda rodada do cron no mesmo mês reporta `noTeto`, não `jaFeitas`, quando
  a carteira já está cheia — a checagem barata acontece antes de abrir transação. As duas respostas
  são verdadeiras; `jaFeitas` só aparece para quem está abaixo do teto, e foi exercitado assim na
  verificação (gastei uma ficha antes de rodar de novo).
- **2026-09-26 (P3):** a sobreposição de horário não é testada pelo caminho da reserva — quando as
  duas chegam em sequência, o motor vê a ocupação e recusa antes de a constraint agir. A constraint em
  si já tem teste em `db/invariantes.test.ts`; o que a suíte da reserva cobre é a **tradução** do
  `23P01`, com um erro fabricado. Anotado porque parece lacuna e não é.
- **2026-09-26 (P3):** `CRON_SECRET` entrou no `.env.local` desta máquina, gerado com 32 bytes
  aleatórios. Precisa ser cadastrado na Vercel (Production, Preview e Development) antes do deploy,
  senão o endpoint responde 503 — de propósito.
- **2026-09-26 (P3):** a mensagem de log do guarda de cron **não** escreve o nome da variável. O teste
  da invariante 5 varre o código à procura de quem lê segredo e uma menção em log dava falso
  positivo; preferi manter o guarda afiado e apontar o leitor para `env.server.ts`.
- **2026-09-26 (P3, verificação):** a senha da Mariana Costa no `mentoria-dev` mudou de novo, para
  `Profissional!Teste2026`, para eu exercitar `/fichas` e a reserva. Ela agora tem **duas sessões
  confirmadas** com a Helena Braga (29/09 e 01/10, 9h) e 5 fichas. O `wallet_ledger` dela tem o
  histórico das duas rodadas de alocação manual, a recarga mensal de 1 e os dois gastos.
- **2026-09-26 (P3, verificação):** o extrato aparecia como ausente numa conferência por regex porque
  o React insere `<!-- -->` entre texto e expressão no SSR — `saldo {n}` sai como `saldo <!-- -->5`.
  Não era defeito da tela.
- **2026-09-26 (P3):** `SidebarTop` não mostra mais nada para Parceiro e RH. Presente é F8 e saldo do
  contrato é F2; mostrar número inventado na casca de quem cuida de dinheiro é pior que não mostrar,
  e é a decisão que já valia para o admin.

- **2026-09-25 (Polimento):** a regra de uma feature por sessão foi quebrada **a pedido** — ícones,
  vocabulário, edição e polimento geral saíram juntos. Anotado para a próxima sessão não tomar isso
  como precedente.
- **2026-09-25 (Polimento, verificação):** a checagem ponta a ponta achou um defeito que os testes de
  banco não alcançavam: trocar o e-mail para um que já existe fazia o servidor de auth responder
  `500 Error updating user`, e a operadora leria "não foi possível trocar o e-mail". Corrigido
  conferindo `auth.users` antes. O exercício rodou as funções reais de `pessoas/editar.ts` com um
  config de Vitest fora do repositório (`server-only` apontado para módulo vazio) e entrou de verdade
  com as credenciais novas, decodificando o JWT.
- **2026-09-25 (Polimento, verificação):** a primeira rodada parou no meio com o e-mail da Mariana
  trocado para um endereço `@teste.local`. O original foi recuperado do `before` em `audit_logs` —
  que é exatamente para isso que ele existe — e restaurado nos dois lugares. Ficaram no histórico dela
  as linhas das duas rodadas (e-mail, senha, desativar, reativar), e duas de pausar/reativar na
  Helena; o livro-caixa é imutável e o `audit_logs` também.
- **2026-09-25 (Polimento, verificação):** **a senha da Mariana Costa no `mentoria-dev` mudou** e não
  foi guardada. Para entrar como ela, gere outra na tela dela — é o fluxo novo.
- **2026-09-25 (Polimento, verificação):** havia um `next` de pé na porta 3000 desde 18h32 (PID 7308),
  provavelmente o `npm run dev` do usuário; não foi tocado. A verificação usou `next start` do build
  na porta 3100.
- **2026-09-25 (Polimento):** `notFound()` dentro do admin responde **200**, não 404 — o
  `loading.tsx` abre o streaming antes de a página decidir. A tela certa aparece; o código HTTP não
  importa atrás de login. Se um dia importar, o `loading` sai do segmento.
- **2026-09-25 (Polimento):** pausar **não** é recusado com sessão futura, ao contrário do plano
  aprovado. Pausar é o que se faz antes de férias justamente para honrar o que já está marcado; só
  arquivar e desativar, que tiram o acesso, são recusados.
- **2026-09-25 (Polimento):** `SENIORIDADES`, `humanizar` e os tipos de linha de lista
  (`lib/admin/tipos.ts`) moram em módulos próprios por causa do cliente: os dois primeiros evitam
  arrastar o `luxon` para o bundle, e o terceiro porque o teste da invariante 5 lê o `from` de
  `consultas.ts` — que é `server-only` — mesmo num `import type`.
- **2026-09-25 (Polimento):** o projeto não é formatado pelo Prettier de ponta a ponta. Só os
  arquivos novos passaram por ele (largura 100); nos existentes, as mudanças foram à mão para não
  gerar diff de ruído.
- **2026-09-25 (Polimento):** ids de rota passam por `ehId()` antes da consulta. Sem isso,
  `/admin/empresas/abc` virava `invalid input syntax for type uuid` e erro 500 — defeito que já
  existia na tela de empresa da P1.

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
