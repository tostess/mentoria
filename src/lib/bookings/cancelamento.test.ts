import { describe, expect, it } from "vitest";
import { fraseDaRecusa, limiteDoEstorno, regraDoCancelamento } from "./cancelamento";

/**
 * A regra do cancelamento (F7), pura. Sessão na terça 29/09 às 9h de São Paulo
 * (12:00Z), prazo de 12 h: a ficha volta até 00:00Z e a sala abre às 11:50Z.
 */

const INICIO = new Date("2026-09-29T12:00:00Z");
const FIM = new Date("2026-09-29T12:30:00Z");
const PRAZO = new Date("2026-09-29T00:00:00Z");
const SALA_ABRE = new Date("2026-09-29T11:50:00Z");
const JANELA = 12;
const MS = 1;

const confirmada = { status: "confirmed", inicio: INICIO, fim: FIM };
const pendente = { status: "pending", inicio: INICIO, fim: FIM };
const antes = (d: Date) => new Date(d.getTime() - MS);

describe("limiteDoEstorno", () => {
  it("é o início menos cancel_window_hours", () => {
    expect(limiteDoEstorno(INICIO, JANELA).toISOString()).toBe(PRAZO.toISOString());
  });
});

describe("regraDoCancelamento — Profissional", () => {
  it("confirmada, antes do prazo: a ficha volta", () => {
    expect(regraDoCancelamento(confirmada, "professional", antes(PRAZO), JANELA)).toEqual({
      pode: true,
      estorna: true,
      compensa: false,
    });
  });

  it("confirmada, no prazo em diante: pode cancelar, a ficha não volta", () => {
    expect(regraDoCancelamento(confirmada, "professional", PRAZO, JANELA)).toEqual({
      pode: true,
      estorna: false,
      compensa: false,
    });
    expect(regraDoCancelamento(confirmada, "professional", antes(SALA_ABRE), JANELA)).toMatchObject({
      pode: true,
      estorna: false,
    });
  });

  it("pedido pendente devolve sempre, até em cima da hora", () => {
    expect(regraDoCancelamento(pendente, "professional", antes(SALA_ABRE), JANELA)).toEqual({
      pode: true,
      estorna: true,
      compensa: false,
    });
  });

  it("quando a sala abre, não dá mais", () => {
    expect(regraDoCancelamento(confirmada, "professional", SALA_ABRE, JANELA)).toEqual({
      pode: false,
      motivo: "sala-aberta",
    });
    expect(regraDoCancelamento(pendente, "professional", SALA_ABRE, JANELA)).toEqual({
      pode: false,
      motivo: "sala-aberta",
    });
  });
});

describe("regraDoCancelamento — Parceiro", () => {
  it("confirmada, antes do prazo: a ficha volta, sem compensação", () => {
    expect(regraDoCancelamento(confirmada, "partner", antes(PRAZO), JANELA)).toEqual({
      pode: true,
      estorna: true,
      compensa: false,
    });
  });

  it("confirmada, em cima da hora: a ficha volta e compensa", () => {
    expect(regraDoCancelamento(confirmada, "partner", PRAZO, JANELA)).toEqual({
      pode: true,
      estorna: true,
      compensa: true,
    });
  });

  it("pedido pendente não se cancela — recusa-se", () => {
    expect(regraDoCancelamento(pendente, "partner", antes(PRAZO), JANELA)).toEqual({
      pode: false,
      motivo: "pedido",
    });
  });

  it("quando a sala abre, não dá mais", () => {
    expect(regraDoCancelamento(confirmada, "partner", SALA_ABRE, JANELA)).toEqual({
      pode: false,
      motivo: "sala-aberta",
    });
  });
});

describe("regraDoCancelamento — status que não é ativo", () => {
  it.each(["cancelled", "expired", "done", "no_show_professional", "no_show_partner"])(
    "%s não se cancela, de nenhum lado",
    (status) => {
      const s = { status, inicio: INICIO, fim: FIM };
      const cedo = new Date("2026-09-25T12:00:00Z");
      expect(regraDoCancelamento(s, "professional", cedo, JANELA)).toEqual({ pode: false, motivo: "status" });
      expect(regraDoCancelamento(s, "partner", cedo, JANELA)).toEqual({ pode: false, motivo: "status" });
    },
  );

  it("cada recusa tem frase própria", () => {
    expect(fraseDaRecusa("sala-aberta", "confirmed")).toMatch(/sala já abriu/);
    expect(fraseDaRecusa("pedido", "pending")).toMatch(/recuse/);
    expect(fraseDaRecusa("status", "cancelled")).toMatch(/já foi cancelada/);
    expect(fraseDaRecusa("status", "expired")).toMatch(/expirou/);
    expect(fraseDaRecusa("status", "done")).toMatch(/encerrada/);
  });
});
