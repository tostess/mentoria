import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assinatura do webhook do Daily — SPIKE P5-0.
 *
 * Conforme a documentação conferida em 27/09/2026
 * (https://docs.daily.co/reference/rest-api/webhooks#hmac): o Daily manda
 * `X-Webhook-Signature` e `X-Webhook-Timestamp`, e a assinatura é
 *
 *     base64( HMAC-SHA256( base64decode(segredo), `${timestamp}.${corpo}` ) )
 *
 * O exemplo da documentação monta o `corpo` com `JSON.stringify(event)` — isto
 * é, re-serializa o objeto já lido. Isso só coincide com o corpo bruto se o
 * Daily mandar JSON compacto e a ordem das chaves sobreviver. Por isso a rota
 * confere as duas formas e **registra qual bateu**: é medição para a P5, que
 * deve ficar só com a que o dado real confirmar (o esperado é o corpo bruto).
 *
 * Puro: sem `server-only`, sem variável de ambiente. O segredo chega por
 * parâmetro.
 */

export function assinar(segredoBase64: string, timestamp: string, corpo: string): string {
  return createHmac("sha256", Buffer.from(segredoBase64, "base64"))
    .update(`${timestamp}.${corpo}`)
    .digest("base64");
}

/** Comparação em tempo constante, como em `lib/cron/guarda.ts`. */
function iguais(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type Verificacao =
  | { ok: true; forma: "bruto" | "reserializado" }
  | { ok: false; motivo: "sem-cabecalho" | "nao-confere" };

export function verificarAssinatura(entrada: {
  segredoBase64: string;
  corpo: string;
  timestamp: string | null;
  assinatura: string | null;
}): Verificacao {
  const { segredoBase64, corpo, timestamp, assinatura } = entrada;
  if (!timestamp || !assinatura) return { ok: false, motivo: "sem-cabecalho" };

  if (iguais(assinatura, assinar(segredoBase64, timestamp, corpo))) {
    return { ok: true, forma: "bruto" };
  }

  let reserializado: string | null = null;
  try {
    reserializado = JSON.stringify(JSON.parse(corpo));
  } catch {
    reserializado = null;
  }
  if (
    reserializado !== null &&
    reserializado !== corpo &&
    iguais(assinatura, assinar(segredoBase64, timestamp, reserializado))
  ) {
    return { ok: true, forma: "reserializado" };
  }

  return { ok: false, motivo: "nao-confere" };
}
