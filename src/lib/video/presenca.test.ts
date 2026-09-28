import { describe, expect, it } from "vitest";
import type { Reuniao } from "./daily";
import { compareceu, desfecho, entradasDasReunioes } from "./presenca";

const INICIO = new Date("2026-09-29T12:00:00Z");
const FIM = new Date("2026-09-29T12:30:00Z");
const PARCEIRO = "00000000-0000-4000-8000-00000000000a";
const PROFISSIONAL = "00000000-0000-4000-8000-00000000000b";
const s = (min: number) => Math.floor(INICIO.getTime() / 1000) + min * 60;

function reuniao(...entradas: [string | null, number, number][]): Reuniao {
  return {
    id: "r1",
    room: "sala",
    start_time: s(-5),
    duration: 0,
    ongoing: false,
    participants: entradas.map(([userId, deMin, ateMin], i) => ({
      user_id: userId,
      participant_id: `p${i}`,
      user_name: null,
      join_time: s(deMin),
      duration: (ateMin - deMin) * 60,
    })),
  };
}

describe("compareceu", () => {
  it("quem ficou durante a sessão compareceu", () => {
    const e = entradasDasReunioes([reuniao([PARCEIRO, -2, 31])]);
    expect(compareceu(e, PARCEIRO, INICIO, FIM)).toBe(true);
  });

  it("quem só testou a câmera antes do horário não compareceu", () => {
    const e = entradasDasReunioes([reuniao([PROFISSIONAL, -8, -3])]);
    expect(compareceu(e, PROFISSIONAL, INICIO, FIM)).toBe(false);
  });

  it("quem chegou atrasado e ficou compareceu", () => {
    const e = entradasDasReunioes([reuniao([PROFISSIONAL, 12, 30])]);
    expect(compareceu(e, PROFISSIONAL, INICIO, FIM)).toBe(true);
  });

  it("entrar na tolerância depois do fim não é ter participado", () => {
    const e = entradasDasReunioes([reuniao([PROFISSIONAL, 31, 34])]);
    expect(compareceu(e, PROFISSIONAL, INICIO, FIM)).toBe(false);
  });

  it("sair e voltar conta pelas duas entradas, em reuniões diferentes", () => {
    const e = entradasDasReunioes([reuniao([PARCEIRO, -8, -4]), { ...reuniao([PARCEIRO, 3, 30]), id: "r2" }]);
    expect(e.map((x) => x.reuniaoId)).toEqual(["r1", "r2"]);
    expect(compareceu(e, PARCEIRO, INICIO, FIM)).toBe(true);
  });

  it("entrada sem user_id não conta para ninguém", () => {
    const e = entradasDasReunioes([reuniao([null, 0, 30])]);
    expect(compareceu(e, PROFISSIONAL, INICIO, FIM)).toBe(false);
  });
});

describe("desfecho", () => {
  it("os dois entraram: done", () => {
    expect(desfecho({ parceiro: true, profissional: true })).toBe("done");
  });

  it("só o Profissional: o Parceiro faltou", () => {
    expect(desfecho({ parceiro: false, profissional: true })).toBe("no_show_partner");
  });

  it("só o Parceiro, ou ninguém: o Profissional faltou", () => {
    expect(desfecho({ parceiro: true, profissional: false })).toBe("no_show_professional");
    expect(desfecho({ parceiro: false, profissional: false })).toBe("no_show_professional");
  });
});
