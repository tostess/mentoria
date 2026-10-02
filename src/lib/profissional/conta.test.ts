import { describe, expect, it } from "vitest";
import { resolveTerms } from "@/lib/terms";
import { deOndeVemAFicha, quemVe, regraDaFicha, validadeDaFicha } from "./conta";

/**
 * O colaborador de empresa e o avulso leem a mesma tela com frases diferentes.
 * O que estes testes travam é a ausência: a conta pessoal nunca lê "RH" nem
 * "sua empresa", e a de empresa nunca lê "pacote".
 */

const t = resolveTerms({});

describe("frases por tipo de conta", () => {
  it("conta pessoal não fala em RH nem em empresa dela", () => {
    const frases = [
      deOndeVemAFicha("pessoal", t),
      quemVe("pessoal", t),
      regraDaFicha("pessoal", 12, t),
    ];
    for (const frase of frases) {
      expect(frase).not.toMatch(/\bRH\b/);
      expect(frase).not.toMatch(/sua empresa/);
    }
    expect(deOndeVemAFicha("pessoal", t)).toMatch(/pacote/);
    expect(quemVe("pessoal", t)).toMatch(/nenhuma empresa vê/);
  });

  it("conta de empresa continua como era", () => {
    expect(deOndeVemAFicha("empresa", t)).toBe("O RH da sua empresa distribui as fichas.");
    expect(quemVe("empresa", t)).toMatch(/^O RH da sua empresa vê quantas fichas/);
    expect(regraDaFicha("empresa", 12, t)).not.toMatch(/pacote/);
  });

  it("validade: meses na conta pessoal, a política na de empresa", () => {
    expect(validadeDaFicha("pessoal", 12, false)).toBe("12 meses após a compra");
    expect(validadeDaFicha("pessoal", 1, false)).toBe("1 mês após a compra");
    expect(validadeDaFicha("empresa", 12, false)).toBe("não expiram");
  });

  it("usa o vocabulário configurado", () => {
    const outro = resolveTerms({ fichas: "créditos", orgAdmin: "Gente & Gestão" });
    expect(deOndeVemAFicha("empresa", outro)).toBe(
      "O Gente & Gestão da sua empresa distribui as créditos.",
    );
    expect(deOndeVemAFicha("pessoal", outro)).toMatch(/créditos/);
  });
});
