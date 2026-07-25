# Setup — conectar o projeto ao Firebase

O repositório já traz tudo que é código. O que sobra são as etapas manuais de
console, que ninguém pode automatizar por você. Faça na ordem.

Projeto Firebase: **`mentoria`** · Região de Functions e Firestore:
**`southamerica-east1`** (fixada em [CLAUDE.md](../CLAUDE.md)).

---

## 1. Registrar o app web

Console > Configurações do projeto > Seus apps > **Web (`</>`)**.

Copie o bloco de configuração do SDK para o `.env.local`:

```bash
cp .env.local.example .env.local
```

| Campo do console | Variável |
|---|---|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

Essas seis são públicas por natureza — vão para o bundle do browser. Não são
segredo; quem protege o dado é `firestore.rules`.

## 2. Baixar a chave da conta de serviço

Console > Configurações do projeto > **Contas de serviço** > Gerar nova chave
privada. Abre o download de um JSON.

Copie **três campos** dele para o `.env.local` e **apague o arquivo**:

```
project_id   → FIREBASE_ADMIN_PROJECT_ID
client_email → FIREBASE_ADMIN_CLIENT_EMAIL
private_key  → FIREBASE_ADMIN_PRIVATE_KEY
```

A `private_key` vai entre aspas, em uma linha só, com os `\n` literais exatamente
como estão no JSON — `src/lib/firebase/admin.ts` desescapa na hora de usar.

> **O JSON não entra no repositório.** O `.gitignore` já bloqueia
> `serviceAccount*.json`, `*-service-account*.json` e `*-firebase-adminsdk-*.json`,
> mas o hábito certo é apagar depois de copiar. Essa chave é acesso irrestrito ao
> projeto: ela ignora as security rules por design.

## 3. Habilitar os provedores de login

Console > **Authentication** > Sign-in method. Habilite:

- **E-mail/senha**
- **Google** (defina o e-mail de suporte do projeto)

Sem isso o `/login` do scaffold falha com `auth/operation-not-allowed`.

## 4. Criar o Firestore

Console > **Firestore Database** > Criar banco de dados > modo **produção**
(regras fechadas) > localização **`southamerica-east1`**.

A localização é **definitiva**: não dá para mudar depois sem recriar o projeto.

## 5. Java, para os emuladores

Os emuladores de Auth e Firestore rodam em JVM. Sem um JDK instalado,
`npm run emu` não sobe.

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
```

Feche e reabra o terminal, confirme com `java -version`, e então:

```bash
npm run emu      # emuladores + UI em http://127.0.0.1:4000
npm run dev:emu  # Next apontando para eles
```

## 6. Antes da F5 — migrar para Blaze

O plano **Spark não implanta Cloud Functions**. Enquanto isso valer, tudo roda em
emulador e `firebase deploy --only functions` vai falhar — é esperado.

A migração precisa acontecer **antes da F5** (carteira), porque `createBooking` é
um callable e o invariante 5 exige que a reserva nasça de uma transação no
servidor. Console > Configurações de uso e faturamento > Detalhes e configurações
> Modificar plano > **Blaze**.

## 7. Alerta de orçamento

Blaze é pós-pago. Configure o teto **no mesmo dia em que migrar**, não depois:

1. [console.cloud.google.com/billing](https://console.cloud.google.com/billing) >
   sua conta de faturamento > **Orçamentos e alertas** > Criar orçamento
2. Escopo: o projeto `mentoria`
3. Valor mensal baixo para começar (ex.: R$ 50)
4. Alertas em 50%, 90% e 100% do valor

O alerta **avisa, não corta**. Para desenvolvimento o volume fica dentro da cota
gratuita do Blaze; o orçamento existe para pegar laço infinito em trigger, que é
como se queima dinheiro de verdade nessa stack.

---

## Conferir que funcionou

```bash
npm run build        # compila sem .env.local — a leitura de env é preguiçosa
npm run emu          # em um terminal
npm run dev:emu      # em outro
```

Com os dois no ar, `GET http://localhost:3000/api/health` deve responder:

```json
{ "ok": true, "data": { "at": "2026-07-25T12:00:00.000Z" } }
```

Se responder `500`, a mensagem diz qual variável falta ou o que o Firestore
recusou. Depois, semeie a configuração e promova seu usuário:

```bash
npm run seed:config
npm run claims:set -- --email voce@exemplo.com --role admin
```

`claims:set` exige que o usuário já exista no Auth — entre uma vez pelo `/login`
antes. Depois de trocar o papel, faça logout/login para o token novo.

---

## O que nunca vai para o repositório

- `.env.local` e qualquer `.env*.local`
- O JSON da conta de serviço, em qualquer nome
- Valores reais de variável dentro de arquivo versionado — inclusive em exemplo,
  comentário ou README
