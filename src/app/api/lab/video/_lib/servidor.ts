import "server-only";

import { getSession } from "@/lib/auth/session";
import { clienteDaily, type ClienteDaily } from "./daily";

/**
 * Único lugar do lab que lê os segredos do Daily — SPIKE P5-0.
 *
 * Mesma regra da invariante 5: sem `NEXT_PUBLIC_`, `server-only` no topo. Na
 * P5 isto se muda para `lib/env.server.ts`, e os dois nomes entram na lista do
 * teste da invariante 5; aqui o spike se cerca sozinho em `lab.test.ts`, para
 * não tocar código fora das pastas do lab.
 */

export const temChaveDaily = Boolean(process.env.DAILY_API_KEY);
export const temSegredoWebhook = Boolean(process.env.DAILY_WEBHOOK_SECRET);

export function segredoWebhook(): string {
  const segredo = process.env.DAILY_WEBHOOK_SECRET;
  if (!segredo) throw new Error("segredo do webhook do Daily ausente");
  return segredo;
}

export function daily(): ClienteDaily {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error("chave do Daily ausente");
  return clienteDaily({ apiKey });
}

/**
 * `/api` fica fora do matcher do proxy, então as rotas do lab se protegem
 * sozinhas: qualquer pessoa logada, de qualquer papel. Sem isso, quem achasse a
 * URL do Preview emitiria token para salas do nosso domínio no Daily.
 */
export async function exigirSessao(): Promise<Response | null> {
  if (!temChaveDaily) {
    console.error("[lab/video] chave do Daily não configurada.");
    return Response.json({ erro: "Daily não configurado neste ambiente." }, { status: 503 });
  }
  const sessao = await getSession();
  if (sessao === null) return Response.json({ erro: "Entre primeiro." }, { status: 401 });
  return null;
}
