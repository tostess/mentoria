import "server-only";

import { headers } from "next/headers";

/**
 * O endereço em que a pessoa está — `localhost`, o Preview ou a produção —,
 * para montar link de e-mail que volte para o mesmo lugar.
 *
 * Vem do cabeçalho `Origin`, que o navegador manda em todo POST de Server
 * Action e o Next confere contra o host. O servidor de auth só redireciona
 * para endereço da lista dele (Authentication → URL Configuration); fora dela,
 * o link cai no Site URL do projeto.
 */
export async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
}
