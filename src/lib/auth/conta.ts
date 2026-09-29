import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
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
