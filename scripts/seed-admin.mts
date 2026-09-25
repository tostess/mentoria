/**
 * Cria (ou reaproveita) a conta de operadora que abre o painel.
 *
 * Existe porque ninguém se autocadastra: o Parceiro entra por decisão do admin
 * e o Profissional é criado pelo RH ou pela operadora. A primeira conta de
 * `admin`, portanto, não tem quem a crie — é este script.
 *
 * Uso:
 *   npm run seed:admin -- ana@operadora.com.br "Ana Ferreira"
 *   npm run seed:admin -- ana@operadora.com.br "Ana Ferreira" --senha "Minha!Senha123"
 *
 * Idempotente: rodar de novo com o mesmo e-mail não duplica nada. Se a conta já
 * existir, o script só garante que o perfil está lá, com papel `admin` e ativo,
 * e redefine a senha quando uma é passada.
 *
 * Invariante 19: o papel vive em `profiles.role` e chega ao JWT pelo
 * `custom_access_token_hook`. Sem o hook ligado no painel do Supabase, esta
 * conta é criada corretamente e **ainda assim** não entra — o token sai sem
 * `user_role` e a tela de entrada responde "acesso inativo". O script avisa.
 */

import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%?";

function senhaProvisoria(tamanho = 16): string {
  let senha = "";
  for (let i = 0; i < tamanho; i += 1) senha += ALFABETO[randomInt(ALFABETO.length)];
  return senha;
}

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`\n  Falta ${nome} no .env.local.\n`);
    process.exit(1);
  }
  return valor;
}

const argumentos = process.argv.slice(2);
const indiceSenha = argumentos.indexOf("--senha");
const senhaEscolhida = indiceSenha === -1 ? null : argumentos[indiceSenha + 1];

/**
 * Posicionais são tudo que não é bandeira **nem valor de bandeira**.
 *
 * Sem excluir o valor de `--senha`, ele entra no nome: nome sem aspas chega
 * como vários argumentos, então o resto da linha é tudo concatenado, e a senha
 * viraria sobrenome.
 */
const posicionais = argumentos.filter(
  (a, i) => !a.startsWith("--") && i !== indiceSenha + 1,
);

const email = posicionais[0]?.trim().toLowerCase();
const nome = posicionais.slice(1).join(" ").trim() || "Operadora";

if (!email || !email.includes("@")) {
  console.error(`
  Uso: npm run seed:admin -- <e-mail> "<nome>" [--senha "<senha>"]

  Exemplo:
    npm run seed:admin -- ana@operadora.com.br "Ana Ferreira"
`);
  process.exit(1);
}

const url = exigir("NEXT_PUBLIC_SUPABASE_URL");
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) {
  console.error("\n  Falta SUPABASE_SECRET_KEY no .env.local.\n");
  process.exit(1);
}
const direct = exigir("DIRECT_URL");

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(direct, { prepare: false, max: 1, connect_timeout: 20 });

/**
 * O e-mail é a chave de reentrada, e a API de admin não tem "buscar por
 * e-mail" — só listagem paginada. Como o piloto tem dezenas de contas e não
 * milhares, varrer as páginas é mais honesto que consultar `auth.users` por
 * SQL: assim o script depende do contrato público do servidor de auth.
 */
async function acharPorEmail(alvo: string): Promise<string | null> {
  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const achado = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (achado) return achado.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function principal() {
  const senha = senhaEscolhida ?? senhaProvisoria();
  let userId = await acharPorEmail(email);
  let criada = false;

  if (userId === null) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    userId = data.user.id;
    criada = true;
  } else if (senhaEscolhida !== null) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: senha });
    if (error) throw new Error(`updateUserById: ${error.message}`);
  }

  // `org_id` fica nulo: invariante 9 — a operadora não pertence a empresa
  // nenhuma, e o `check` de `profiles` recusaria a linha com empresa.
  const [perfil] = await sql<{ id: string; papel: string; criado: boolean }[]>`
    insert into profiles (id, role, name, email, active)
    values (${userId}, 'admin', ${nome}, ${email}, true)
    on conflict (id) do update
      set role = 'admin',
          name = excluded.name,
          email = excluded.email,
          active = true,
          deleted_at = null
    returning id, role::text as papel, (xmax = 0) as criado`;

  console.log(`
  Conta de operadora pronta.

    e-mail    ${email}
    nome      ${nome}
    papel     ${perfil.papel}
    user_id   ${perfil.id}
    ${criada || senhaEscolhida !== null ? `senha     ${senha}` : "senha     (mantida)"}
    ${criada ? "identidade criada agora" : "identidade já existia"} · ${perfil.criado ? "perfil criado agora" : "perfil atualizado"}
`);

  await avisarSobreOHook();
}

/**
 * Confere de verdade se o hook está ligado, entrando com a conta e olhando o
 * token — e não perguntando ao painel, que não expõe isso por API pública.
 *
 * Vale o esforço porque este é o único erro do projeto que não produz mensagem
 * nenhuma: esquema certo, conta certa, hook desligado, e todo login termina em
 * "acesso inativo" sem nada nos logs.
 */
async function avisarSobreOHook() {
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publishable || senhaEscolhida === null) {
    console.log(
      "  Confira em Authentication > Hooks se o Customize Access Token está ligado\n" +
        "  em public.custom_access_token_hook. Sem isso, o login termina em acesso inativo.\n",
    );
    return;
  }

  const cliente = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senhaEscolhida });
  if (error || !data.session) {
    console.log(`  Não foi possível conferir o hook (entrada falhou: ${error?.message}).\n`);
    return;
  }

  const payload = JSON.parse(
    Buffer.from(data.session.access_token.split(".")[1], "base64url").toString(),
  ) as Record<string, unknown>;
  await cliente.auth.signOut();

  if (payload.user_role === "admin") {
    console.log("  Hook ligado: o token saiu com user_role=admin. Pode entrar em /entrar.\n");
    return;
  }

  console.log(`  ATENÇÃO — o hook de access token está DESLIGADO.

  O token saiu sem user_role, então o login vai terminar em "acesso inativo".
  Ligue em: Authentication > Hooks > Customize Access Token
            > public.custom_access_token_hook > Enable
  Depois rode este script de novo para confirmar.
`);
}

try {
  await principal();
} catch (erro) {
  console.error("\n  Falhou:", erro instanceof Error ? erro.message : erro, "\n");
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
