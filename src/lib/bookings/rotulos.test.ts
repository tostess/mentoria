import { describe, expect, it } from "vitest";
import { bookingStatus } from "@/lib/db/schema/enums";
import { ehAtiva, rotuloDoStatus } from "./rotulos";

describe("rótulos do status da sessão", () => {
  it.each(bookingStatus.enumValues)("%s tem rótulo em português", (status) => {
    const { rotulo } = rotuloDoStatus(status, false);
    expect(rotulo).not.toBe(status);
    expect(rotulo).not.toMatch(/_/);
  });

  it("cancelada pelo Parceiro é recusa", () => {
    expect(rotuloDoStatus("cancelled", true).rotulo).toBe("Recusada");
    expect(rotuloDoStatus("cancelled", false).rotulo).toBe("Cancelada");
  });

  it("a falta muda de nome com quem olha", () => {
    const profissional = { lado: "professional", parceiro: "parceira" } as const;
    const parceiro = { lado: "partner", parceiro: "parceira" } as const;

    expect(rotuloDoStatus("no_show_partner", false, profissional).rotulo).toBe("Parceira faltou");
    expect(rotuloDoStatus("no_show_professional", false, profissional).rotulo).toBe("Você não entrou");
    expect(rotuloDoStatus("no_show_professional", false, parceiro).rotulo).toBe("Não compareceu");
    expect(rotuloDoStatus("no_show_partner", false, parceiro).rotulo).toBe("Você não entrou");
    // Os outros status não dependem do lado.
    expect(rotuloDoStatus("done", false, parceiro).rotulo).toBe("Realizada");
  });

  it("só pendente e confirmada são ativas — o mesmo recorte da constraint", () => {
    expect(bookingStatus.enumValues.filter(ehAtiva)).toEqual(["pending", "confirmed"]);
  });
});
