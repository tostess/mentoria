import { labFechado } from "../_lib/cerca";
import { verificarAssinatura } from "../_lib/assinatura";
import { segredoWebhook, temSegredoWebhook } from "../_lib/servidor";

/**
 * SPIKE P5-0 — pergunta 4: receptor do webhook do Daily. **Só log, nada no
 * banco.**
 *
 * Sem sessão (o Daily não tem cookie): quem prova a origem é a assinatura.
 * Recusa como o `autorizarCron`: segredo ausente no servidor é **503** —
 * servidor sem condição de verificar —, assinatura ausente ou errada é
 * **401**. De fora são indistinguíveis; no log dizem coisas diferentes.
 *
 * O Daily exige 200 em até 8 s na criação do webhook e desativa o webhook
 * depois de 3 falhas: responder rápido, trabalho lento depois.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fechado = labFechado();
  if (fechado) return fechado;

  const recebidoEm = Date.now() / 1000;

  if (!temSegredoWebhook) {
    console.error("[lab/video/webhook] segredo não configurado — recusado.");
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const corpo = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp");
  const verificacao = verificarAssinatura({
    segredoBase64: segredoWebhook(),
    corpo,
    timestamp,
    assinatura: request.headers.get("x-webhook-signature"),
  });

  if (!verificacao.ok) {
    console.warn(`[lab/video/webhook] recusado: ${verificacao.motivo}`);
    return new Response(null, { status: 401, headers: { "cache-control": "no-store" } });
  }

  let evento: unknown = null;
  try {
    evento = JSON.parse(corpo);
  } catch {
    evento = null;
  }

  const e = (typeof evento === "object" && evento !== null ? evento : {}) as {
    type?: unknown;
    id?: unknown;
    event_ts?: unknown;
    payload?: unknown;
    test?: unknown;
  };

  // Uma linha por evento, JSON, para dar para ler a sequência no log da Vercel
  // e medir atraso: `recebido_em - event_ts` é a viagem do Daily até aqui.
  console.log(
    "[lab/video/webhook]",
    JSON.stringify({
      recebido_em: recebidoEm,
      atraso_s: typeof e.event_ts === "number" ? Number((recebidoEm - e.event_ts).toFixed(3)) : null,
      assinatura: verificacao.forma,
      cabecalho_timestamp: timestamp,
      type: e.type ?? (e.test ? "verificacao" : null),
      id: e.id ?? null,
      event_ts: e.event_ts ?? null,
      payload: e.payload ?? null,
    }),
  );

  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}
