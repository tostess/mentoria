import { autorizarCron } from "@/lib/cron/guarda";
import { loadAppConfig } from "@/lib/config/load";
import { fecharSessoes } from "@/lib/bookings";

/**
 * `close-sessions` — a cada 15 minutos.
 *
 * Sessão confirmada cujo `end_at` + `session_grace_minutes` passou é decidida
 * pela presença que o Daily registrou (invariante 18): `done`, `no_show_partner`
 * (estorno e compensação) ou `no_show_professional`. Sem chave do Daily no
 * ambiente, vale a regra da P4 e ela vira `done`.
 *
 * Idempotente pela trava da sessão: a segunda execução não acha mais nada
 * `confirmed` para fechar. Daily fora do ar deixa a sessão para a próxima.
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
    const resultado = await fecharSessoes(new Date(), config);
    const houveErro = resultado.erros.length > 0;

    console.log(
      `[close-sessions] ${resultado.feitas} fechadas, ${resultado.jaResolvidas} já resolvidas, ` +
        `${resultado.erros.length} erros, ${Date.now() - comecou}ms`,
    );

    // 207 pelo mesmo motivo do allocate-monthly: a rodada aconteceu, e parte pede atenção.
    return Response.json(
      { ok: !houveErro, ms: Date.now() - comecou, ...resultado },
      { status: houveErro ? 207 : 200, headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    console.error("[close-sessions] rodada abortada:", erro instanceof Error ? erro.message : erro);
    return Response.json(
      { ok: false, erro: "rodada abortada" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
