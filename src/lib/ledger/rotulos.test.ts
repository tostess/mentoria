import { describe, expect, it } from "vitest";
import { ledgerType } from "@/lib/db/schema/enums";
import { rotuloDoLancamento } from "./rotulos";

describe("rótulos do livro-caixa", () => {
  // Lido do enum do esquema, não de uma lista copiada: um tipo novo no banco
  // entra aqui sozinho e o teste cobra o rótulo dele.
  it.each(ledgerType.enumValues)("%s tem rótulo em português", (tipo) => {
    const { rotulo } = rotuloDoLancamento(tipo);
    expect(rotulo).not.toBe(tipo);
    expect(rotulo).not.toMatch(/_/);
  });

  it("tipo desconhecido sai humanizado", () => {
    expect(rotuloDoLancamento("bonus_partner").rotulo).toBe("Bonus partner");
  });
});
