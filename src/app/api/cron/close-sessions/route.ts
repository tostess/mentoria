import { autorizarCron } from "@/lib/cron/guarda";
import { loadAppConfig } from "@/lib/config/load";
import { fecharSessoes } from "@/lib/bookings";

/**
 * `close-sessions` — a cada 15 minutos.
 *
 * Sessão confirmada cujo `end_at` + `session_grace_minutes` passou vira `done`.
 * **Regra provisória da P4**: sem sala não há presença, então nenhuma sessão
 * termina em `no_show_*` por enquanto. A P5 troca a regra pela presença lida da
 * sala, neste mesmo endpoint.
 *
 * Idempotente pela trava da sessão: a segunda execução não acha mais nada
 * `confirmed` para fechar.
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
