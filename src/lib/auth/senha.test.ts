import { describe, expect, it } from "vitest";
import { problemaNaSenhaNova, problemaNaTroca, SENHA_MAX, SENHA_MIN } from "./senha";

const BOA = "Outra!Senha42";

function troca(parcial: Partial<{ atual: string; nova: string; confirmacao: string }>) {
  return problemaNaTroca({ atual: "Provisoria#123", nova: BOA, confirmacao: BOA, ...parcial });
}

describe("problemaNaTroca", () => {
  it("aceita senha nova válida, confirmada e diferente da atual", () => {
    expect(troca({})).toBeNull();
  });

  it("exige a senha atual — quem está com o computador de outra pessoa aberto não troca", () => {
    expect(troca({ atual: "" })).toMatch(/senha que você usa hoje/);
  });

  it("exige a senha nova", () => {
    expect(troca({ nova: "", confirmacao: "" })).toMatch(/senha nova/);
  });

  it(`recusa menos de ${SENHA_MIN} caracteres e aceita exatamente ${SENHA_MIN}`, () => {
    const curta = "a".repeat(SENHA_MIN - 1);
    const justa = "a".repeat(SENHA_MIN);
    expect(troca({ nova: curta, confirmacao: curta })).toMatch(/pelo menos/);
    expect(troca({ nova: justa, confirmacao: justa })).toBeNull();
  });

  it(`recusa mais de ${SENHA_MAX} — o bcrypt ignoraria o excesso`, () => {
    const longa = "a".repeat(SENHA_MAX + 1);
    expect(troca({ nova: longa, confirmacao: longa })).toMatch(/no máximo/);
  });

  it("recusa espaço nas pontas, que some sem ninguém ver", () => {
    expect(troca({ nova: ` ${BOA}`, confirmacao: ` ${BOA}` })).toMatch(/espaço/);
  });

  it("recusa confirmação diferente", () => {
    expect(troca({ confirmacao: `${BOA}x` })).toMatch(/confirmação/);
  });

  it("recusa repetir a atual — a provisória continuaria valendo", () => {
    expect(troca({ atual: BOA })).toMatch(/diferente da atual/);
  });
});

describe("problemaNaSenhaNova — a senha do cadastro", () => {
  it("aceita senha válida e confirmada", () => {
    expect(problemaNaSenhaNova(BOA, BOA)).toBeNull();
  });

  it("exige a senha", () => {
    expect(problemaNaSenhaNova("", "")).toMatch(/Crie uma senha/);
  });

  it("usa os mesmos limites da troca", () => {
    const curta = "a".repeat(SENHA_MIN - 1);
    const longa = "a".repeat(SENHA_MAX + 1);
    expect(problemaNaSenhaNova(curta, curta)).toMatch(/pelo menos/);
    expect(problemaNaSenhaNova("a".repeat(SENHA_MIN), "a".repeat(SENHA_MIN))).toBeNull();
    expect(problemaNaSenhaNova(longa, longa)).toMatch(/no máximo/);
  });

  it("recusa espaço nas pontas em vez de apagá-lo", () => {
    expect(problemaNaSenhaNova(` ${BOA}`, ` ${BOA}`)).toMatch(/espaço/);
  });

  it("exige a confirmação igual", () => {
    expect(problemaNaSenhaNova(BOA, `${BOA}x`)).toMatch(/confirmação/);
  });
});
