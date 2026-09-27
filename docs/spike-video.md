# Spike P5-0 — vídeo (Daily)

Sessão de 27/09/2026, branch `spike/video`. Descartável: responde com medição as perguntas que
decidem o desenho da P5. Nada tocou banco, policy, motor de agenda ou migração.

**Como foi medido.** Chrome headless dirigido por CDP (`--use-fake-device-for-media-stream`), sem
dependência nova, cada participante num contexto de navegador isolado, entrando no Daily Prebuilt
por `https://tostes.daily.co/<sala>?t=<token>`. Presença lida pela REST a cada 5–10 s; horários
exatos de entrada e saída lidos depois em `GET /meetings?room=`. Fotos da tela nos momentos que
importam. Os scripts estão em `src/app/api/lab/video/_medicao/` e rodam de novo com
`node --no-warnings src/app/api/lab/video/_medicao/medir.mjs` (e `medir2.mjs`). Nos resultados,
`+Ns` é o tempo desde o início do script, e é também a base de `exp`/`nbf`.

Documentação conferida no mesmo dia em `https://docs.daily.co/llms.txt` (versão Markdown das
páginas de referência: salas, tokens, webhooks, erros, presença, reuniões).

## Resumo

| # | Pergunta | Resposta curta |
|---|---|---|
| 1 | Criação concorrente | Uma recebe 200; as outras, **400 `invalid-request-error`** — o mesmo erro de nome inválido. `garantirSala` confirma por `GET`. |
| 2 | Token e janela | `nbf`/`exp` do token só controlam a **entrada**. Quem está dentro fica, a menos que o token tenha `eject_at_token_exp`. |
| 3 | Extensão | **Hipótese refutada.** A hora de expulsão é fixada **na entrada** de cada participante; mudar `exp` da sala depois não alcança quem já está lá. O que funciona: fim decidido pelo servidor (`POST /eject`). |
| 4 | Webhook | **Adiado por decisão sua.** Rota e assinatura prontas e testadas localmente; dois bloqueios fora do código registrados. E achado: `GET /meetings` já dá presença exata sem webhook. |
| 5 | Celular | Página pronta; roteiro de observação abaixo. Depende de você. |

Bloqueio encontrado no caminho: **sem cartão cadastrado o Daily não abre chamada nenhuma** (a sala
mostra "Missing payment method" e a presença fica em 0) e não libera webhook (`invalid-plan-type`).
Cartão cadastrado por você durante a sessão.

---

## 1. Criação concorrente

**Requisição** — sala privada, nome = UUID novo, disparada 2× e depois 6× em paralelo:

```
POST https://api.daily.co/v1/rooms
{ "name": "<uuid>", "privacy": "private", "properties": { "exp": <agora+3600> } }
```

**Respostas medidas**

| Caso | Status | Corpo |
|---|---|---|
| a que venceu (1 de 2, 1 de 6) | 200 | a sala, `url: https://tostes.daily.co/<uuid>` |
| as que perderam, e uma terceira sequencial | **400** | `{"error":"invalid-request-error","info":"a room named <uuid> already exists"}` |
| nome com espaço | **400** | `{"error":"invalid-request-error","info":"com espaço contains invalid characters (room names can contain A-Z, a-z, 0-9, '-', and '_')"}` |
| chave errada | 401 | `{"error":"authentication-error"}` |
| `GET /rooms/<uuid>` existente | 200 | a sala |
| `GET /rooms/<uuid>` inexistente | 404 | `{"error":"not-found","info":"room <uuid> not found"}` |

**Observação.** "Já existe" e "pedido ruim" são indistinguíveis pelo campo estável (`error`). A
diferença só está em `info`, que a documentação de erros manda tratar como texto de depuração
que pode mudar. UUID é nome válido (tem `-`), então `booking_id` serve direto como nome.

**`garantirSala(nome, propriedades)`** (`src/app/api/lab/video/_lib/daily.ts`): tenta criar; em
400, pergunta `GET /rooms/:nome`; se existe, devolve `{ sala, criada: false }`; se não existe, o 400
era de verdade e sobe como veio; outro status sobe sem a leitura. Criar primeiro porque, na primeira
entrada da sessão, o normal é a sala não existir — uma viagem em vez de duas. Sala existente volta
**como está**, sem reaplicar propriedades: mudar `exp` é decisão explícita, não efeito colateral de
uma entrada. Seis testes em `daily.test.ts`, contra um Daily falso que reproduz as respostas acima,
inclusive três criações simultâneas (uma cria, as três recebem a mesma sala).

---

## 2. Token e janela

Token com `room_name`, `user_name`, `user_id`, `nbf`, `exp`, `is_owner` (só Parceiro),
`enable_prejoin_ui: false` (para o robô entrar direto), `lang: "pt-BR"`.

| Cenário | O que se viu | Evidência |
|---|---|---|
| Entrar **antes do `nbf`** | Tela "Esta chamada ainda não está disponível. Tente novamente mais tarde…" com botão **Tentar novamente**. Não entra sozinho quando o `nbf` passa. | S1 aos +20 s e +95 s (`nbf` = +75 s); presença 0 |
| Depois do `nbf`, clicar **Tentar novamente** | Entra. | E4: botão clicado a +50 s (`nbf` +40), entrou a +55 s |
| Depois do `nbf`, **recarregar** a página | "Você não tem permissão para participar desta chamada". O Prebuilt tira o `?t=` da URL depois de ler; recarregar é entrar **sem token**. | S1 a +120 s |
| Depois do `nbf`, abrir o link com token de novo | Entra. | E4 segunda aba, entrou a +54 s |
| Entrar **depois do `exp`** | "Esta chamada não está mais disponível". | S2: token com `exp` +45 s, nova aba a +100 s; `/meetings` não registra a entrada |
| **Já dentro** quando o `exp` do token vence, **sem** `eject_at_token_exp` | **Fica.** | S2: entrou +8 s, continuava a +294 s (fim do script) |
| Já dentro, **com** `eject_at_token_exp: true` | Aviso "A reunião terminará em 0:09" e expulsão **no segundo exato**: "Você foi removido da chamada". | S3: entrou +9 s, saiu **+45 s** |
| Criar token com `exp` no passado | 400 `"exp was '…', which is in the past rather than in the future"` | curl |

**Qual propriedade controla a permanência.** `exp`/`nbf` do token são porta de entrada.
Permanência é `eject_at_token_exp` ou `eject_after_elapsed` no token, ou `eject_at_room_exp` na
sala. A documentação diz, e o desenho da P5 depende disso: **se o token tiver qualquer propriedade
de expulsão, as da sala são ignoradas para aquele participante.**

**Mesma coisa para a sala** (S6, sala com `exp` +60 s sem `eject_at_room_exp`): quem estava dentro
ficou até +293 s; uma segunda pessoa tentando entrar a +90 s não entrou (`/meetings` só lista uma).
`exp` de sala também é recusado no passado (400).

---

## 3. Extensão — a pergunta mais importante

### A hipótese

Fim da sessão na **sala** (`exp` + `eject_at_room_exp: true`), tokens **sem** propriedade de
expulsão; estender = `POST /rooms/:nome { properties: { exp: novo } }`.

### O que aconteceu

A atualização em si funciona e é rápida (200 em ~0,8 s, `config.exp` novo na resposta). Mas não
alcança quem já está na chamada.

| Cenário | Sala | O que se fez | Saídas medidas em `/meetings` |
|---|---|---|---|
| **S4** controle | `exp` +90, ejeção ligada | nada | Parceiro **+90 s**, Profissional +84 s |
| **S5** hipótese | `exp` +90, ejeção ligada | aos +45 s, `exp` → **+210** | Parceiro **+90 s**, Profissional +84 s — idêntico ao controle |
| **E2** desligar | `exp` +90, ejeção ligada | aos +45 s, `exp` → +600 **e** `eject_at_room_exp: false` | **+91 s** — expulso mesmo assim |
| **E1** reentrar | `exp` +90, ejeção ligada | aos +45 s, `exp` → +210; aos +56 s **só o Profissional** reentra com token novo | Parceiro **+91 s**; Profissional (2ª entrada) **+210 s** |

Na S5, aos +61 s — 16 s depois da extensão — a tela do Profissional ainda dizia "A reunião
terminará em 0:29", isto é, o fim antigo. Na E1, aos +76 s, as duas abas lado a lado mostravam
**"0:13"** (Parceiro, que ficou) e **"2:13"** (Profissional, que reentrou).

**Conclusão.** A hora de expulsão é calculada **quando cada participante entra**, a partir das
propriedades da sala e do token naquele instante, e não muda depois — nem desligando a ejeção. É
por isso que o `participant.joined` do webhook carrega `will_eject_at`: é um valor por entrada. O
CLAUDE.md tem dois erros aqui: "estender prorroga `exp` do token" (token é imutável) e a hipótese
da sala (medido acima). Nenhum dos dois prolonga uma chamada em andamento.

### O que funciona

**E3 — fim decidido pelo servidor.** Sala com `exp` longo e **sem** `eject_at_room_exp`, tokens
com `user_id`. Aos +60 s:

```
POST /rooms/<sala>/eject   { "user_ids": ["e3-parceiro", "e3-prof"] }
→ 200 em 1,3 s  { "ejectedIds": ["29e8a97f-…", "1ccee2f2-…"] }
```

Os dois saíram a **+63 s** (`/meetings`); a tela mostrou "Você foi removido da chamada" 2 s depois
da chamada. `user_ids` é o `user_id` posto no token — o servidor expulsa sem consultar presença
antes. Reentrar em seguida com token válido funciona (+75 s).

**Aviso de fim do Prebuilt.** Medido com salas a 20, 10, 5 e 3 minutos do `exp`: o banner
"A reunião terminará em m:ss" aparece **só nos últimos 5 minutos** (a 10 e 20 não aparece). O
banner lê o mesmo valor fixado na entrada.

### Alternativas e custo

| | Como estende | Custo |
|---|---|---|
| **A. Fim pelo servidor** | Muda `bookings.end_at` e nada no Daily; um trabalho de minuto em minuto chama `/eject` quando `end_at` (+ tolerância) passa | Precisa de cron por minuto (a Vercel Pro permite). Se o cron falhar, a chamada não acaba sozinha. |
| **B. Reentrada forçada** | `POST /rooms` com `exp` novo e **as duas telas recarregam o iframe com token novo** | Corte visível de ~3–5 s (E1: reentrada em 3 s) no momento que o sistema de design reserva para animação. Iframe puro não sabe *quando* recarregar sem polling ou `daily-js`. |
| **C. Teto na sala + fim pelo servidor** (recomendada) | Como A, com a sala criada já com o **teto máximo** (`exp` = início + 30 + 30 + tolerância, `eject_at_room_exp: true`) | Mesmo cron de A. Em troca: se o cron falhar, ninguém passa do teto; e o banner do Prebuilt nunca mente — sessão sem extensão é expulsa pelo servidor muito antes dos 5 min finais do teto; sessão estendida termina no teto, que é o fim de verdade. |
| D. `daily-js` | Não resolve: a expulsão é do servidor do Daily. Serve para trocar a tela "Você foi removido… de maneira inesperada" por uma nossa. | Dependência nova; não é indispensável para nenhuma pergunta deste spike. |

Detalhes de C que o spike fixou:

- Token **sem** `eject_at_token_exp`/`eject_after_elapsed` — qualquer um deles anula o teto da sala.
- Token emitido **a cada entrada**, com `exp` = `end_at` atual + tolerância. Depois de estender, o
  token antigo não serve para reentrar (S2), e não precisa: a próxima entrada emite outro.
- `user_id` do token = `profiles.id` (UUID tem 36 caracteres, o limite do Daily). É o que
  `/eject` e `/meetings` usam.
- Encerrar "agora" nunca é por `exp`: `exp` no passado é recusado (400). É `/eject`.

---

## 4. Webhook

**Adiado** (sua decisão nesta sessão). Dois bloqueios fora do código, ambos medidos:

1. **Plano.** `GET /webhooks` → `{"error":"invalid-plan-type","info":"This feature is only
   available to paid accounts…"}`. Resolvido com o cartão; não refeito depois.
2. **Proteção do Preview.** O projeto tem Vercel Authentication em todo deploy que não é domínio
   próprio (`ssoProtection.deploymentType = all_except_custom_domains`). Sem login, `POST
   /api/lab/video/webhook` no Preview responde **302** para o login da Vercel. O Daily exige 200 em
   até 8 s na criação do webhook, sem nova tentativa. Saída: *Protection Bypass for Automation*
   (segredo que o Daily mandaria na URL) — é mudança de configuração do projeto, não feita.

**O que ficou pronto**, em `src/app/api/lab/video/`:

- `_lib/assinatura.ts` — `base64(HMAC-SHA256(base64decode(segredo), "${X-Webhook-Timestamp}.${corpo}"))`,
  comparação em tempo constante, conforme a documentação. O exemplo oficial assina
  `JSON.stringify(evento)` (o objeto re-serializado), não o corpo bruto; a verificação aceita os
  dois e **registra qual bateu** — a P5 deve ficar só com o que o tráfego real mostrar. Oito testes.
- `webhook/route.ts` — recusa como o `autorizarCron`: segredo ausente no servidor → **503** com log
  próprio; assinatura ausente ou errada → **401**. Aceita o `{"test":"test"}` de verificação.
  Uma linha JSON por evento com `recebido_em`, `atraso_s` (= recebido − `event_ts`), `type`, `id` e
  a carga. Nada no banco.
- Exercitado com `next dev`: sem assinatura 401, assinatura errada 401, verificação assinada 200,
  evento assinado 200, sem segredo 503.

**O que a documentação diz da carga** (a conferir no tráfego real): `participant.joined` e
`participant.left` trazem `room`, `user_id` (o do token), `user_name`, `session_id` (um por
entrada: sair e voltar gera outro), `joined_at`, `will_eject_at`, `owner`; o `left` traz também
`duration`. `meeting.started`/`meeting.ended` trazem `room`, `meeting_id`, `start_ts`/`end_ts`; o
`ended` pode atrasar até 20 s (espera reconexão). Entrega "aproximadamente, não estritamente, em
ordem", **com duplicatas**, às vezes com `id` diferente — deduplicar `participant.*` por
`type` + `session_id`. Três falhas seguidas desligam o webhook (`circuit-breaker`, padrão) — ou
`retryType: exponential`, 5 tentativas em até 15 min.

**Achado que muda a pergunta: presença sem webhook.** `GET /meetings?room=<sala>` devolve, por
entrada, `user_id`, `participant_id`, `user_name`, `join_time` e `duration` — foi a fonte de todos os
horários exatos deste documento. Disponível sem plano especial, idempotente, lido pelo servidor
quando quiser. Para `close-sessions` decidir `done` × `no_show_*`, ler `/meetings` no fechamento
basta, e não exige endpoint público nem bypass. A presença da REST em tempo real
(`/rooms/:nome/presence`) atrasa ~10–25 s e mostra sessões fantasmas depois de reentrada (E1: "3
pessoas" numa sala de 2) — serve para painel, não para decisão.

**Um webhook por domínio.** A configuração do domínio `tostes` tem `max_webhook_count: 1`, e o
webhook recebe eventos de **todas** as salas do domínio. Com um domínio só, Preview e Production
não podem ter cada um o seu webhook, e salas de teste chegariam à produção. Ver decisão 5 da P5.

---

## 5. Celular — roteiro para você

A página é `/lab/video` no Preview da branch `spike/video`
(`https://mentoria-git-spike-video-tostess-projects.vercel.app/lab/video`, ou o endereço do deploy
mais recente em `npx vercel ls`). Para abrir no celular é preciso **entrar na Vercel** (proteção do
Preview) e **entrar na aplicação** com qualquer conta do `mentoria-dev`. Atalho sem nenhum dos dois:
monte a sala no computador, clique **Copiar link** e mande o link direto do Daily para o celular.

Montagem: no computador, *Criar ou reencontrar* com fim em 45 min; *Token de Parceiro*, entrar pelo
computador; *Token de Profissional*, abrir no celular — uma vez pelo **link direto** e uma vez pelo
**iframe** (botão *Entrar aqui*), que é como a P5 vai embutir. O painel *Estado* no computador
mostra quem o Daily vê lá dentro, com ~10–25 s de atraso.

| Observar | iPhone · Safari | Android · Chrome |
|---|---|---|
| O pedido de câmera e microfone aparece? Uma vez ou a cada entrada? | | |
| Pelo iframe também? (o `allow="camera; microphone…"` está no iframe; sem ele o Safari nega calado) | | |
| A tela de teste antes de entrar aparece e cabe na tela? | | |
| Câmera começa na frontal? Existe botão de trocar para a traseira, e ele funciona? | | |
| Girar o celular: o vídeo acompanha? | | |
| **Bloquear a tela 30 s**: o outro lado vê imagem congelada, preta ou avatar? O áudio continua? | | |
| Ao desbloquear: volta sozinho ou precisa tocar? A presença no computador caiu e voltou? | | |
| **Bloquear 3 min**: mesma coisa. Ao voltar, está na chamada ou numa tela de erro? | | |
| Trocar de app (WhatsApp) e voltar: mesma coisa. | | |
| Som sai no alto-falante ou no fone de ouvido do celular? Fone bluetooth funciona? | | |
| Recarregar a página dentro da chamada: cai em "sem permissão"? (esperado: sim, o `?t=` some) | | |
| Estender 2 min no computador quando faltar menos de 5: o aviso do celular muda? (esperado: não) | | |

---

## Também levantado

### Limites e custo contra o piloto

- **10.000 minutos-participante grátis por mês**; depois **US$ 0,004** por minuto-participante de
  vídeo (faixa de 10 mil a 100 mil), sem mensalidade (página de preços, 27/09/2026). Cartão
  obrigatório para qualquer uso (medido).
- Piloto estimado: 30 Profissionais × 2 sessões × 30 min × 2 pessoas ≈ **3.600/mês**; com toda
  sessão estendida para 60, ≈ 7.200. Cabe no gratuito com folga. Cada rodada deste spike gasta
  poucos minutos.
- Participantes por sala: 200 por padrão; `max_participants: 2` é aceito no nosso plano.
- Domínio: `max_api_keys: 2` (dá para girar chave sem parar), `max_webhook_count: 1`.
- HIPAA: US$ 500/mês — não se aplica (nada é gravado; a gravação está desligada por padrão).

### Região da mídia (nota de LGPD)

- `geo` padrão é nulo: o servidor da chamada é escolhido pela região **mais próxima do primeiro a
  entrar** (Route 53). Pode ser fixado por sala ou por domínio; **`geo: "sa-east-1"` (São Paulo) é
  aceito** no nosso plano (medido).
- A lista pública de servidores de mídia do Daily (`ip-info.daily.co/ips/ip-info.json`) tem São
  Paulo em dois provedores: `sa-east-1` (AWS) e `sa-saopaulo-1` (OCI).
- A arquitetura é *mesh SFU*: cada participante fala com o servidor mais perto dele, e os servidores
  conversam entre si. Um Parceiro fora do Brasil faria a mídia dele passar pela região dele.
- Fora da mídia, o Daily (empresa dos EUA) guarda `user_name`, `user_id` e horários em `/meetings`.
  Para a nota: mídia em São Paulo com `geo` fixado; `user_name` mínimo (primeiro nome);
  `user_id` como UUID opaco; gravação desligada; e a transferência internacional (LGPD art. 33)
  para os metadados. "Regional Media Zones" aparece como item gratuito na página de preços, sem
  documentação técnica achada — perguntar ao Daily se a garantia de região for exigência.

### Onde mora o `canExtend`

**Correção à premissa.** Com descanso de 15 min e grade de 30, depois de uma sessão 9h00–9h30 a
seguinte mais cedo começa às **10h00**. Estendida, a primeira vira 9h00–10h00, e
`tstzrange` é semiaberto (`[)`) por padrão: **não há sobreposição e `bookings_no_overlap` não
recusa**. Conferido no `mentoria-dev`, só leitura:

```sql
select tstzrange('…09:00','…10:00') && tstzrange('…10:00','…10:30');  -- false
select tstzrange('…09:00','…10:00') && tstzrange('…09:30','…10:00');  -- true (descanso 0)
```

O que a extensão viola é o **descanso**, que só o motor conhece. A constraint só pega o caso de
descanso zero. Então a checagem precisa existir em código — e o motor está travado.

**Proposta:** função pura nova, fora de `scheduling/`, por exemplo `src/lib/sessao/extensao.ts`:

```ts
podeEstender({ sessao, outrasDoParceiro, bufferMin, extensoesNoMes, cotaMensal, agora, minutos })
  → { ok: true } | { ok: false, motivo: "ja-estendida" | "fora-da-janela" | "sem-cota"
                                      | "colide-com-a-seguinte" }
```

- `outrasDoParceiro` vem de **`lerOcupacoes`** — a mesma leitura que a reserva usa, que o roteiro
  da P4 (passo 3) já manda exportar. Leitura diferente aqui faria a sala oferecer extensão que a
  gravação recusa.
- `colide-com-a-seguinte`: existe sessão ativa `b` com `b.start_at < fim + minutos + bufferMin`.
  É a mesma regra de descanso do motor, aplicada a um intervalo que o motor não gera (o motor
  produz candidatos na grade; a extensão é um intervalo fixo) — por isso não é reuso, e não é
  alteração do motor.
- A extensão reconfere tudo **dentro da transação** que grava `end_at` e `extended_by`, como a
  reserva recalcula o motor antes de escrever. A tela usa a mesma função só para decidir se mostra
  o botão.
- **Corrida com uma reserva nova no intervalo: fechada pelo aviso mínimo.** A extensão acontece
  perto do fim da sessão; uma reserva criada no mesmo instante precisa começar a pelo menos
  `min_notice_hours` (12 h) de agora. Enquanto `min_notice_hours × 60 > minutos + bufferMin`, não
  existe reserva capaz de cair no intervalo — dispensa trava extra. Vale um teste que prenda essa
  desigualdade contra `app_config`, para ninguém baixar o aviso mínimo para 30 min e abrir a corrida
  sem perceber.
- O que **não** entra: regra semanal e teto semanal. O Parceiro está na sala decidindo passar do
  horário; a disponibilidade descreve o que ele aceita reservar, não o que ele pode escolher fazer.

---

## O código do spike

Tudo em `src/app/lab/video/` e `src/app/api/lab/video/`, 404 com `VERCEL_ENV === "production"`
(medido rodando: as cinco rotas 404; sem sessão 401; sem chave 503), cercado por `_lib/lab.test.ts`.

| Arquivo | Destino na P5 |
|---|---|
| `_lib/daily.ts` — `garantirSala`, `lerSala`, `atualizarSala`, `emitirToken`, `ejetar`, `presenca`, `reunioes`, `ErroDaily` | **Aproveitar**, movido para `src/lib/video/daily.ts`, puro, com `daily.test.ts`. Tirar `apagarSala`/`presenca` se não houver uso. |
| `_lib/assinatura.ts` + teste | **Aproveitar** em `src/lib/video/`, ficando com uma forma só (bruto ou re-serializado) depois do primeiro evento real. |
| `webhook/route.ts` | **Aproveitar o esqueleto** (503/401/200, corpo como texto, resposta rápida) — trocando o log por `session_events` com deduplicação por `type` + `session_id`. |
| `_lib/lab.test.ts` | **Aproveitar a ideia**: os nomes `DAILY_*` entram na lista da invariante 5 em `server-only.test.ts`, e a leitura vai para `lib/env.server.ts`. |
| `_lib/servidor.ts`, `_lib/entrada.ts`, `_lib/cerca.ts`, `sala/`, `token/`, `estender/`, `page.tsx`, `LabVideo.tsx` | **Morrer.** Bancada, não produto. A rota de entrada da P5 emite token para o `booking_id` do JWT, não para nome livre. |
| `_medicao/*.mjs` | **Morrer com a branch**, depois do teste de celular e da medição do webhook. |

Teste: 26 no lab (6 de `garantirSala`, 8 de assinatura, 12 da cerca); a suíte inteira passa (430 em 27 arquivos).
