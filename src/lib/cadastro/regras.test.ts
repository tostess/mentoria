import { describe, expect, it } from "vitest";
import { CampoInvalido } from "@/lib/forms";
import { CAMPO_ARMADILHA, caiuNaArmadilha, lerCadastro, OBJETIVO_MAX } from "./regras";

const SENHA = "Boa!Senha42";

function formulario(campos: Record<string, string | null> = {}): FormData {
  const base: Record<string, string | null> = {
    nome: "Joana Ribeiro",
    email: "Joana@Gmail.com",
    senha: SENHA,
    confirmacao: SENHA,
    telefone: "",
    cargo: "Enfermeira",
    area: "",
    linkedin: "",
    objetivo: "Quero conversar sobre liderança de equipe no plantão.",
    aceite: "on",
    ...campos,
  };
  const form = new FormData();
  for (const [nome, valor] of Object.entries(base)) {
    if (valor !== null) form.set(nome, valor);
  }
  return form;
}

function erro(form: FormData): string {
  try {
    lerCadastro(form);
  } catch (e) {
    if (e instanceof CampoInvalido) return e.message;
    throw e;
  }
  throw new Error("esperava CampoInvalido");
}

describe("lerCadastro", () => {
  it("lê o cadastro válido, com e-mail em minúsculas e opcionais vazios como nulos", () => {
    const c = lerCadastro(formulario());
    expect(c).toEqual({
      nome: "Joana Ribeiro",
      email: "joana@gmail.com",
      senha: SENHA,
      telefone: null,
      cargo: "Enfermeira",
      area: null,
      linkedin: null,
      objetivo: "Quero conversar sobre liderança de equipe no plantão.",
    });
  });

  it("exige nome, e-mail válido e o que a pessoa busca", () => {
    expect(erro(formulario({ nome: "  " }))).toMatch(/seu nome/);
    expect(erro(formulario({ email: "joana" }))).toMatch(/E-mail inválido/);
    expect(erro(formulario({ objetivo: "" }))).toMatch(/o que você busca/);
  });

  it(`limita o texto do objetivo a ${OBJETIVO_MAX} caracteres`, () => {
    expect(erro(formulario({ objetivo: "a".repeat(OBJETIVO_MAX + 1) }))).toMatch(/limite/);
    expect(lerCadastro(formulario({ objetivo: "a".repeat(OBJETIVO_MAX) })).objetivo).toHaveLength(
      OBJETIVO_MAX,
    );
  });

  it("aplica a regra da senha nova — curta, diferente da confirmação", () => {
    expect(erro(formulario({ senha: "curta", confirmacao: "curta" }))).toMatch(/pelo menos/);
    expect(erro(formulario({ confirmacao: `${SENHA}!` }))).toMatch(/confirmação/);
  });

  it("não apara a senha: espaço na ponta é recusado, não apagado", () => {
    expect(erro(formulario({ senha: `${SENHA} `, confirmacao: `${SENHA} ` }))).toMatch(/espaço/);
  });

  it("exige o aceite dos termos", () => {
    expect(erro(formulario({ aceite: null }))).toMatch(/aceite os termos/);
  });

  it("aceita o LinkedIn sem https e guarda com", () => {
    const c = lerCadastro(formulario({ linkedin: "linkedin.com/in/joana-ribeiro" }));
    expect(c.linkedin).toBe("https://linkedin.com/in/joana-ribeiro");
  });

  it("recusa link que não é endereço web — `javascript:` nunca vira link na tela", () => {
    expect(erro(formulario({ linkedin: "javascript:alert(1)" }))).toMatch(/LinkedIn/);
    expect(erro(formulario({ linkedin: "joana" }))).toMatch(/LinkedIn/);
  });
});

describe("armadilha para robô", () => {
  it("só dispara quando o campo invisível vem preenchido", () => {
    expect(caiuNaArmadilha(formulario())).toBe(false);
    expect(caiuNaArmadilha(formulario({ [CAMPO_ARMADILHA]: "" }))).toBe(false);
    expect(caiuNaArmadilha(formulario({ [CAMPO_ARMADILHA]: "https://spam.example" }))).toBe(true);
  });
});
