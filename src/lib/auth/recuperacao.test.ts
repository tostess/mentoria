import { describe, expect, it } from "vitest";
import { lerFragmento, RECUPERACAO_MINUTOS, sessaoDeRecuperacao } from "./recuperacao";

const AGORA = new Date("2026-10-07T12:00:00Z");
const segundos = (d: Date) => Math.floor(d.getTime() / 1000);

describe("sessaoDeRecuperacao", () => {
  it("aceita sessão de link de e-mail aberto agora há pouco", () => {
    expect(sessaoDeRecuperacao([{ method: "otp", timestamp: segundos(AGORA) - 60 }], AGORA)).toBe(true);
  });

  it(`recusa link aberto há mais de ${RECUPERACAO_MINUTOS} minutos`, () => {
    const velho = segundos(AGORA) - RECUPERACAO_MINUTOS * 60 - 1;
    expect(sessaoDeRecuperacao([{ method: "otp", timestamp: velho }], AGORA)).toBe(false);
  });

  it("recusa sessão de entrada por senha — cookie roubado não troca a senha sem a atual", () => {
    expect(sessaoDeRecuperacao([{ method: "password", timestamp: segundos(AGORA) }], AGORA)).toBe(false);
  });

  it("recusa o que não é lista de métodos", () => {
    expect(sessaoDeRecuperacao(undefined, AGORA)).toBe(false);
    expect(sessaoDeRecuperacao("otp", AGORA)).toBe(false);
    expect(sessaoDeRecuperacao([{ method: "otp", timestamp: "agora" }], AGORA)).toBe(false);
  });
});

describe("lerFragmento", () => {
  it("lê os tokens do link que deu certo", () => {
    expect(lerFragmento("#access_token=a.b.c&refresh_token=r1&type=recovery")).toEqual({
      tipo: "tokens",
      accessToken: "a.b.c",
      refreshToken: "r1",
    });
  });

  it("reconhece o link vencido pelo erro do servidor de auth", () => {
    expect(lerFragmento("#error=access_denied&error_code=otp_expired&sb=")).toEqual({ tipo: "erro" });
  });

  it("sem fragmento não há o que trocar", () => {
    expect(lerFragmento("")).toEqual({ tipo: "vazio" });
    expect(lerFragmento("#access_token=sozinho")).toEqual({ tipo: "vazio" });
  });
});
