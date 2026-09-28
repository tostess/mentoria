import { describe, expect, it } from "vitest";
import { fichasUsadas } from "./uso";

describe("fichasUsadas", () => {
  it("conta o gasto", () => {
    expect(fichasUsadas([{ tipo: "spend", quantidade: -1 }, { tipo: "spend", quantidade: -1 }])).toBe(2);
  });

  it("pedido recusado ou expirado não é uso: o estorno desconta o gasto", () => {
    expect(
      fichasUsadas([
        { tipo: "refund", quantidade: 1 },
        { tipo: "spend", quantidade: -1 },
        { tipo: "spend", quantidade: -1 },
      ]),
    ).toBe(1);
  });

  it("presente, alocação e compensação não contam", () => {
    expect(
      fichasUsadas([
        { tipo: "gift", quantidade: 1 },
        { tipo: "allocate", quantidade: 2 },
        { tipo: "adjust", quantidade: 1 },
      ]),
    ).toBe(0);
  });

  it("estorno cujo gasto ficou fora da janela não deixa a conta negativa", () => {
    expect(fichasUsadas([{ tipo: "refund", quantidade: 1 }])).toBe(0);
  });
});
