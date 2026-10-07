import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoDeRecuperacao } from "./recuperacao";
import { CHAVE_SENHA_PROVISORIA } from "./senha";

/**
 * A conta de quem está logado, do ponto de vista do servidor de auth.
 *
 * A marca de senha provisória vive em `app_metadata` e não em `profiles`
 * por três motivos: chega no JWT sem consulta nenhuma (a casca renderiza em
 * paralelo com a página, e uma leitura a mais por tela é custo à toa); só o
 * `service_role` a escreve, então a pessoa não se livra do aviso sem trocar a
 * senha; e `profiles` é legível por colegas de empresa — "fulano ainda está
 * com a senha que chegou pelo WhatsApp" não é coisa que um colega precise ler.
 */

/**
 * A senha digitada é a atual?
 *
 * Conferida por um cliente sem sessão e sem cookie: entrar com ele não mexe na
 * sessão do navegador. A sessão que ele abre é encerrada na hora, e só ela —
 * `scope: "local"`, porque o padrão (`global`) derrubaria também a sessão em
 * que a pessoa está trocando a senha.
 */
export async function senhaConfere(email: string, senha: string): Promise<boolean> {
  const { url, publishableKey } = requireSupabasePublicEnv();
  const avulso = createSupabaseClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await avulso.auth.signInWithPassword({ email, password: senha });
  if (error !== null) return false;

  await avulso.auth.signOut({ scope: "local" }).catch(() => undefined);
  return true;
}

/**
 * Tira a marca de senha provisória. Só depois de a senha ter sido trocada de
 * fato — a ordem inversa liberaria o aviso para uma troca que falhou.
 *
 * `app_metadata` é mesclado pelo servidor de auth, não substituído: o
 * `provider` que ele mesmo escreve continua lá.
 */
export async function liberarDaSenhaProvisoria(userId: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    app_metadata: { [CHAVE_SENHA_PROVISORIA]: false },
  });
  if (error !== null) throw new Error(`não foi possível tirar a marca: ${error.message}`);
}

/**
 * Manda o link de "Esqueceu a senha?". A resposta não diz se o e-mail tem
 * conta — o servidor de auth também não diz —, então a tela é a mesma para
 * todos. Só o limite de envio volta, porque é a única coisa que a pessoa
 * precisa saber para agir.
 */
export async function enviarLinkDeRecuperacao(email: string, destino: string): Promise<"ok" | "limite"> {
  const { error } = await clienteSemSessao().auth.resetPasswordForEmail(email, { redirectTo: destino });
  if (error === null) return "ok";
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "limite";
  }
  console.warn(`[conta] link de recuperação recusado: ${error.code ?? ""} ${error.message}`);
  return "ok";
}

export type Redefinicao = "ok" | "link-vencido" | "fraca" | "igual";

/**
 * Troca a senha com a sessão que o link do e-mail abriu.
 *
 * A sessão é conferida pelo servidor de auth (`setSession`) e o token assinado
 * tem de ter nascido de link de e-mail há pouco (`sessaoDeRecuperacao`). Depois
 * da troca, a marca de senha provisória sai — quem escolheu a senha foi a
 * própria pessoa — e **todas** as sessões dela são encerradas: se alguém
 * pediu recuperação porque desconfiou de acesso alheio, o acesso alheio cai
 * junto. A pessoa entra de novo com a senha nova.
 */
export async function redefinirPorLink(
  accessToken: string,
  refreshToken: string,
  nova: string,
): Promise<Redefinicao> {
  const cliente = clienteSemSessao();
  const { error: erroSessao } = await cliente.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (erroSessao !== null) return "link-vencido";

  const { data } = await cliente.auth.getClaims(accessToken);
  const claims = data?.claims;
  if (!claims || !sessaoDeRecuperacao(claims.amr, new Date())) return "link-vencido";

  const { error } = await cliente.auth.updateUser({ password: nova });
  if (error !== null) {
    if (error.code === "weak_password") return "fraca";
    if (error.code === "same_password") return "igual";
    throw new Error(`não foi possível redefinir a senha: ${error.code ?? ""} ${error.message}`);
  }

  try {
    await liberarDaSenhaProvisoria(claims.sub);
  } catch (erro) {
    console.error(`[conta] senha de ${claims.sub} redefinida, marca não saiu:`, erro);
  }
  await cliente.auth.signOut({ scope: "global" }).catch(() => undefined);
  return "ok";
}

function clienteSemSessao() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  return createSupabaseClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
