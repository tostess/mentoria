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

  it("só pendente e confirmada são ativas — o mesmo recorte da constraint", () => {
    expect(bookingStatus.enumValues.filter(ehAtiva)).toEqual(["pending", "confirmed"]);
  });
});
