import { autorizarCron } from "@/lib/cron/guarda";
import { loadAppConfig } from "@/lib/config/load";
import { expirarPendentes } from "@/lib/bookings";

/**
 * `expire-pending` — de hora em hora.
 *
 * Pedido sem resposta em `pending_expires_hours`, ou cujo horário já chegou,
 * vira `expired` e a ficha volta. Idempotente pela trava da sessão e pela chave
 * `refund_{bookingId}` (invariante 16): rodar de novo não estorna duas vezes, e
 * é a mesma chave da recusa do Parceiro, então os dois caminhos não se somam.
 *
 * `GET` porque é o que a Vercel Cron dispara; a segurança é do segredo e da chave.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uma transação por sessão, sequencial — a conexão de runtime é `max: 1`. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const recusa = autorizarCron(request);
  if (recusa !== null) return recusa;

  const comecou = Date.now();
  try {
    const config = await loadAppConfig();
    const resultado = await expirarPendentes(new Date(), config);
    const houveErro = resultado.erros.length > 0;

    console.log(
      `[expire-pending] ${resultado.feitas} expiradas, ${resultado.jaResolvidas} já resolvidas, ` +
        `${resultado.erros.length} erros, ${Date.now() - comecou}ms`,
    );

    // 207 pelo mesmo motivo do allocate-monthly: a rodada aconteceu, e parte pede atenção.
    return Response.json(
      { ok: !houveErro, ms: Date.now() - comecou, ...resultado },
      { status: houveErro ? 207 : 200, headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    console.error("[expire-pending] rodada abortada:", erro instanceof Error ? erro.message : erro);
    return Response.json(
      { ok: false, erro: "rodada abortada" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
