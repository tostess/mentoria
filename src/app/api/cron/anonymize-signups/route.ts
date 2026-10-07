import { autorizarCron } from "@/lib/cron/guarda";
import { limparRecusados } from "@/lib/cadastro";

/**
 * `anonymize-signups` — uma vez por dia.
 *
 * Duas limpezas do cadastro self-service (A3), as duas idempotentes:
 *
 * 1. Apaga o login de pedido recusado que a recusa não conseguiu apagar (a
 *    chamada ao servidor de auth vem depois do commit e pode falhar).
 * 2. Anonimiza o pedido recusado há mais de 90 dias (LGPD): a linha fica, sem
 *    nome, contato nem o que a pessoa escreveu, e ganha `anonymized_at`.
 *
 * `GET` porque é o que a Vercel Cron dispara; a segurança é do segredo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function GET(request: Request) {
  const recusa = autorizarCron(request);
  if (recusa !== null) return recusa;

  const comecou = Date.now();
  try {
    const resultado = await limparRecusados(new Date());
    const houveErro = resultado.loginsComErro > 0;

    console.log(
      `[anonymize-signups] ${resultado.loginsApagados} logins apagados, ` +
        `${resultado.loginsComErro} com erro, ${resultado.anonimizados} anonimizados, ` +
        `${Date.now() - comecou}ms`,
    );

    // 207 como nos outros crons: a rodada aconteceu, e parte pede atenção.
    return Response.json(
      { ok: !houveErro, ms: Date.now() - comecou, ...resultado },
      { status: houveErro ? 207 : 200, headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    console.error("[anonymize-signups] rodada abortada:", erro instanceof Error ? erro.message : erro);
    return Response.json(
      { ok: false, erro: "rodada abortada" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
