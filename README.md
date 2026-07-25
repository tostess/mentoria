# App de Mentoria

Marketplace de mentoria com oferta curada e economia de moedas. O contexto de
produto, os invariantes e o roadmap estao em [CLAUDE.md](CLAUDE.md) — leia antes
de mexer no codigo.

## Rodar

```bash
npm install
cp .env.local.example .env.local   # preencha com as chaves do seu projeto Firebase
npm run dev
```

As etapas de console (registrar app web, chave da conta de servico, provedores de
login, Java para os emuladores, Blaze antes da F5) estao em
[docs/SETUP.md](docs/SETUP.md).

Contra os emuladores, sem precisar de credencial nenhuma:

```bash
npm run emu       # emuladores + UI em http://127.0.0.1:4000  (exige JDK)
npm run dev:emu   # Next apontando para eles
```

`GET /api/health` e o teste de fumaca da conexao: escreve em `_health/ping` pelo
Admin SDK, le de volta e devolve `{ ok: true }`.

Antes do primeiro login, semeie a configuracao e promova seu usuario:

```bash
npm run seed:config                                        # orgs/public + appConfig/public
npm run claims:set -- --email voce@exemplo.com --role admin # primeiro admin
```

`claims:set` exige que o usuario ja exista no Auth (ou seja: entre uma vez pelo
`/login` antes). Depois de trocar o papel, faca logout/login para o token novo.

## Estrutura

```
src/app/
  (auth)/login          entrada unica
  (mentee)/             /inicio /mentores /agenda /carteira
  (mentor)/             /mentor /mentor/disponibilidade /mentor/agenda
  (admin)/              /admin /admin/mentores /admin/personalizacao
src/lib/
  auth/                 papeis, custom claims, contexto de sessao
  config/               tipos e defaults de appConfig (semente, nao fonte de verdade)
  firebase/             SDK de cliente e Admin SDK, ambos por env
  firestore/scoped.ts   helpers de orgId (invariante 9)
  scheduling/           motor puro de disponibilidade — F2, travado depois dos testes
functions/              Cloud Functions em southamerica-east1
scripts/                seed de appConfig e claims por CLI
```

## Seguranca

- `firestore.rules` nega por padrao. `bookings` e `wallets` sao **somente
  leitura** para o cliente: escrita so pelo Admin SDK, via callable.
- Papeis vivem em custom claims (`role`, `orgId`); `users/{uid}` so espelha.
- Guard de rota (`RoleGate`) e conveniencia de navegacao, nao seguranca.

- A chave da conta de servico ignora as rules por design. Ela vive em
  `.env.local` (tres campos, `FIREBASE_ADMIN_*`), nunca como arquivo no repo.

Para testar as rules localmente:

```bash
npm run emu
```

## Testes

```bash
npm test          # Vitest
npm run typecheck # tsc --noEmit
npm run lint
```
