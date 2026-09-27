import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinar, verificarAssinatura } from "./assinatura";

const segredo = randomBytes(32).toString("base64");

/** A fórmula copiada da documentação do Daily, escrita à parte de propósito. */
function comoADocumentacao(segredoBase64: string, timestamp: string, evento: unknown): string {
  const assinado = timestamp + "." + JSON.stringify(evento);
  return createHmac("sha256", Buffer.from(segredoBase64, "base64")).update(assinado).digest("base64");
}

const evento = {
  version: "1.0.0",
  type: "participant.joined",
  id: "ptcpt-join-x",
  payload: { room: "sala", session_id: "s1", joined_at: 1708972279.96 },
  event_ts: 1708972279.961,
};

describe("assinatura do webhook", () => {
  it("bate com a fórmula da documentação sobre o corpo bruto", () => {
    const corpo = JSON.stringify(evento);
    const ts = "1708972280";

    expect(assinar(segredo, ts, corpo)).toBe(comoADocumentacao(segredo, ts, evento));
    expect(
      verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: ts, assinatura: comoADocumentacao(segredo, ts, evento) }),
    ).toEqual({ ok: true, forma: "bruto" });
  });

  it("aceita a assinatura sobre o JSON reserializado quando o corpo veio formatado", () => {
    const corpo = JSON.stringify(evento, null, 2);
    const ts = "1708972280";

    expect(
      verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: ts, assinatura: comoADocumentacao(segredo, ts, evento) }),
    ).toEqual({ ok: true, forma: "reserializado" });
  });

  it("aceita o pedido de verificação que o Daily manda ao criar o webhook", () => {
    const corpo = '{"test":"test"}';
    const ts = "1790550000";
    const assinatura = assinar(segredo, ts, corpo);

    expect(verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: ts, assinatura })).toEqual({
      ok: true,
      forma: "bruto",
    });
  });

  it("recusa corpo adulterado", () => {
    const ts = "1708972280";
    const assinatura = assinar(segredo, ts, JSON.stringify(evento));
    const adulterado = JSON.stringify({ ...evento, payload: { ...evento.payload, room: "outra" } });

    expect(verificarAssinatura({ segredoBase64: segredo, corpo: adulterado, timestamp: ts, assinatura })).toEqual({
      ok: false,
      motivo: "nao-confere",
    });
  });

  it("recusa timestamp trocado — ele faz parte do que é assinado", () => {
    const corpo = JSON.stringify(evento);
    const assinatura = assinar(segredo, "1708972280", corpo);

    expect(verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: "1708972281", assinatura }).ok).toBe(false);
  });

  it("recusa segredo errado", () => {
    const corpo = JSON.stringify(evento);
    const assinatura = assinar(randomBytes(32).toString("base64"), "1", corpo);

    expect(verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: "1", assinatura }).ok).toBe(false);
  });

  it("recusa sem os cabeçalhos, sem calcular nada", () => {
    const corpo = JSON.stringify(evento);

    expect(verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: null, assinatura: "x" })).toEqual({
      ok: false,
      motivo: "sem-cabecalho",
    });
    expect(verificarAssinatura({ segredoBase64: segredo, corpo, timestamp: "1", assinatura: null })).toEqual({
      ok: false,
      motivo: "sem-cabecalho",
    });
  });

  it("assinatura de tamanho diferente não estoura o timingSafeEqual", () => {
    expect(
      verificarAssinatura({ segredoBase64: segredo, corpo: "{}", timestamp: "1", assinatura: "curta" }).ok,
    ).toBe(false);
  });
});
