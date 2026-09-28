import { describe, expect, it } from "vitest";
import { mmss, relogio } from "./relogio";

const MIN = 60_000;
const INICIO = Date.parse("2026-09-29T12:00:00Z");
const FIM = INICIO + 30 * MIN;
const FECHA = FIM + 5 * MIN;
const em = (min: number) => INICIO + min * MIN;

describe("relogio", () => {
  it("antes do horário conta até o início", () => {
    expect(relogio(em(-7), INICIO, FIM, FECHA)).toEqual({ fase: "antes", segundos: 420 });
  });

  it("durante a sessão conta até o fim", () => {
    expect(relogio(em(0), INICIO, FIM, FECHA)).toEqual({ fase: "sessao", segundos: 1800 });
  });

  it("os últimos cinco minutos são a reta final — o mesmo instante do aviso do Prebuilt", () => {
    expect(relogio(em(25) - 1, INICIO, FIM, FECHA).fase).toBe("sessao");
    expect(relogio(em(25), INICIO, FIM, FECHA)).toEqual({ fase: "reta-final", segundos: 300 });
  });

  it("depois do fim conta até a sala fechar", () => {
    expect(relogio(em(30), INICIO, FIM, FECHA)).toEqual({ fase: "tolerancia", segundos: 300 });
  });

  it("no fechamento a sala acaba, no segundo exato", () => {
    expect(relogio(FECHA - 1, INICIO, FIM, FECHA).fase).toBe("tolerancia");
    expect(relogio(FECHA, INICIO, FIM, FECHA)).toEqual({ fase: "fechada", segundos: 0 });
  });

  it("arredonda para cima: nunca mostra 0:00 com a sessão ainda aberta", () => {
    expect(relogio(FIM - 400, INICIO, FIM, FECHA).segundos).toBe(1);
  });
});

describe("mmss", () => {
  it("minutos e segundos", () => {
    expect(mmss(1122)).toBe("18:42");
    expect(mmss(5)).toBe("0:05");
  });

  it("horas quando passa de uma", () => {
    expect(mmss(3909)).toBe("1:05:09");
  });

  it("negativo vira zero", () => {
    expect(mmss(-3)).toBe("0:00");
  });
});
