import { describe, expect, it } from "vitest";
import { bookingStatus } from "@/lib/db/schema/enums";
import { ehAtiva, rotuloDoStatus } from "./rotulos";

describe("rótulos do status da sessão", () => {
  it.each(bookingStatus.enumValues)("%s tem rótulo em português", (status) => {
    const { rotulo } = rotuloDoStatus(status, null);
    expect(rotulo).not.toBe(status);
    expect(rotulo).not.toMatch(/_/);
  });

  it("pedido cancelado pelo Parceiro é recusa; sessão confirmada é cancelamento", () => {
    const profissional = { lado: "professional", parceiro: "parceira" } as const;
    const parceiro = { lado: "partner", parceiro: "parceira" } as const;
    const recusa = { por: "partner", eraPedido: true } as const;
    const doParceiro = { por: "partner", eraPedido: false } as const;
    const doProfissional = { por: "professional", eraPedido: false } as const;

    expect(rotuloDoStatus("cancelled", recusa).rotulo).toBe("Recusada");
    expect(rotuloDoStatus("cancelled", null).rotulo).toBe("Cancelada");
    // Desmarcada pelo Parceiro: má notícia para quem ia participar, e só para ele.
    expect(rotuloDoStatus("cancelled", doParceiro, profissional)).toEqual({ rotulo: "Cancelada", variante: "bad" });
    expect(rotuloDoStatus("cancelled", doParceiro, parceiro)).toEqual({ rotulo: "Cancelada", variante: "off" });
    expect(rotuloDoStatus("cancelled", doProfissional, profissional)).toEqual({ rotulo: "Cancelada", variante: "off" });
    expect(rotuloDoStatus("cancelled", doProfissional, parceiro)).toEqual({ rotulo: "Cancelada", variante: "off" });
  });

  it("a falta muda de nome com quem olha", () => {
    const profissional = { lado: "professional", parceiro: "parceira" } as const;
    const parceiro = { lado: "partner", parceiro: "parceira" } as const;

    expect(rotuloDoStatus("no_show_partner", null, profissional).rotulo).toBe("Parceira faltou");
    expect(rotuloDoStatus("no_show_professional", null, profissional).rotulo).toBe("Você não entrou");
    expect(rotuloDoStatus("no_show_professional", null, parceiro).rotulo).toBe("Não compareceu");
    expect(rotuloDoStatus("no_show_partner", null, parceiro).rotulo).toBe("Você não entrou");
    // Os outros status não dependem do lado.
    expect(rotuloDoStatus("done", null, parceiro).rotulo).toBe("Realizada");
  });

  it("só pendente e confirmada são ativas — o mesmo recorte da constraint", () => {
    expect(bookingStatus.enumValues.filter(ehAtiva)).toEqual(["pending", "confirmed"]);
  });
});
