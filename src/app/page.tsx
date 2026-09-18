import { redirect } from "next/navigation";
import { HOME_BY_ROLE } from "@/lib/auth/routes";
import { getSession } from "@/lib/auth/session";

/**
 * A raiz não tem tela: cada papel tem a sua. O `proxy.ts` resolve isto antes
 * de chegar aqui; esta página é a mesma decisão escrita de novo, para o dia
 * em que o matcher mudar e ninguém lembrar deste caminho.
 *
 * O índice de cascas da Etapa 1 morreu aqui — trocar de casca deixou de ser
 * possível quando o papel passou a vir do JWT.
 */
export default async function Home() {
  const session = await getSession();
  redirect(session === null ? "/entrar" : HOME_BY_ROLE[session.role]);
}
