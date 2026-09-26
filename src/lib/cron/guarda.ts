import "server-only";

import { timingSafeEqual } from "node:crypto";
import { hasCronSecret, requireCronSecret } from "@/lib/env.server";

/**
 * A porta dos endpoints de `/api/cron/*`.
 *
 * `api/*` fica fora do matcher do `proxy.ts` de propósito (decisão da Etapa 4):
 * a Vercel dispara o cron sem cookie nenhum, então o guarda de sessão só o
 * barraria. Em troca, cada handler se protege sozinho — e este módulo é esse
 * "sozinho", num lugar só, para não haver um endpoint que esqueceu.
 *
 * O que ele **não** faz é confiar em cabeçalho `x-vercel-*`: qualquer um manda
 * um. O que prova a origem é o segredo compartilhado.
 */

/** O que o handler deve responder quando o guarda recusa, ou null quando passa. */
export type Recusa = Response;

/**
 * Comparação em tempo constante.
 *
 * `a === b` vaza o tamanho do prefixo correto pelo tempo de resposta, e um
 * endpoint que recarrega carteira é alvo suficiente para isso valer a linha. O
 * comprimento é igualado antes porque `timingSafeEqual` estoura com tamanhos
 * diferentes — e o tamanho em si não é segredo.
 */
function iguais(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Confere o `Authorization: Bearer <segredo>`.
 *
 * Devolve `null` quando a requisição pode seguir, ou a `Response` de recusa —
 * assim o handler fica `const recusa = autorizarCron(request); if (recusa) return recusa;`
 * e não há como esquecer de interromper.
 *
 * Sem o segredo configurado responde **503**, não 401: não é que quem pediu
 * errou a credencial, é que o servidor não está em condição de rodar trabalho
 * agendado. Os dois casos são indistinguíveis de fora, mas o log e o painel da
 * Vercel dizem coisas diferentes, e isso decide se alguém vai procurar a
 * variável ou o segredo errado.
 */
export function autorizarCron(request: Request): Recusa | null {
  if (!hasCronSecret) {
    // O nome da variável não é escrito aqui de propósito: o teste da invariante
    // 5 varre o código à procura de quem lê segredo, e uma menção em log daria
    // falso positivo. Quem precisa do nome acha em `env.server.ts`.
    console.error("[cron] segredo do trabalho agendado não configurado — endpoint recusado.");
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const cabecalho = request.headers.get("authorization") ?? "";
  const prefixo = "Bearer ";
  const recebido = cabecalho.startsWith(prefixo) ? cabecalho.slice(prefixo.length) : "";

  if (recebido === "" || !iguais(recebido, requireCronSecret())) {
    return new Response(null, { status: 401, headers: { "cache-control": "no-store" } });
  }

  return null;
}
