import { describe, expect, it } from "vitest";
import { segundos } from "./daily";
import { porta, primeiroNome, propriedadesDaSala, propriedadesDoToken } from "./sala";

const INICIO = new Date("2026-09-29T12:00:00Z");
const FIM = new Date("2026-09-29T12:30:00Z");
const MINUTO = 60_000;
const confirmada = { status: "confirmed", inicio: INICIO, fim: FIM };
const em = (min: number) => new Date(INICIO.getTime() + min * MINUTO);

describe("porta", () => {
  it("abre dez minutos antes do horário, e não um segundo antes", () => {
    expect(porta(confirmada, new Date(em(-10).getTime() - 1000))).toMatchObject({ aberta: false, motivo: "cedo" });
    expect(porta(confirmada, em(-10))).toMatchObject({ aberta: true });
  });

  it("fecha cinco minutos depois do fim", () => {
    expect(porta(confirmada, new Date(em(35).getTime() - 1000))).toMatchObject({ aberta: true });
    expect(porta(confirmada, em(35))).toMatchObject({ aberta: false, motivo: "encerrada" });
  });

  it("pedido pendente não tem sala, nem no horário", () => {
    expect(porta({ ...confirmada, status: "pending" }, em(5))).toMatchObject({
      aberta: false,
      motivo: "nao-confirmada",
    });
  });

  it("devolve a janela mesmo fechada, para a tela dizer a hora em que abre", () => {
    const p = porta(confirmada, em(-60));
    expect(p.janela.abre.toISOString()).toBe(em(-10).toISOString());
    expect(p.janela.fecha.toISOString()).toBe(em(35).toISOString());
  });
});

describe("propriedadesDaSala", () => {
  it("a sala expulsa sozinha no fim + 5, com dois lugares e mídia em São Paulo", () => {
    expect(propriedadesDaSala(INICIO, FIM)).toEqual({
      nbf: segundos(em(-10)),
      exp: segundos(em(35)),
      eject_at_room_exp: true,
      max_participants: 2,
      enable_prejoin_ui: true,
      lang: "pt-BR",
      geo: "sa-east-1",
    });
  });
});

describe("propriedadesDoToken", () => {
  const quem = { userId: "b7a4d1d2-0000-4000-8000-000000000001", nome: "  Helena  Braga ", ehParceiro: true };

  it("leva só o primeiro nome e o id do perfil", () => {
    const t = propriedadesDoToken("sala-1", INICIO, FIM, quem);
    expect(t.user_name).toBe("Helena");
    expect(t.user_id).toBe(quem.userId);
    expect(t.room_name).toBe("sala-1");
  });

  it("só o Parceiro é dono da sala", () => {
    expect(propriedadesDoToken("s", INICIO, FIM, quem).is_owner).toBe(true);
    expect(propriedadesDoToken("s", INICIO, FIM, { ...quem, ehParceiro: false }).is_owner).toBe(false);
  });

  it("quem clica em sair volta para a tela de fim nossa", () => {
    const t = propriedadesDoToken("s", INICIO, FIM, quem, "https://app.exemplo/sala/s/fim");
    expect(t.redirect_on_meeting_exit).toBe("https://app.exemplo/sala/s/fim");
    expect(propriedadesDoToken("s", INICIO, FIM, quem)).not.toHaveProperty("redirect_on_meeting_exit");
  });

  it("nenhuma propriedade de expulsão no token — ela anularia a da sala", () => {
    const t = propriedadesDoToken("s", INICIO, FIM, quem) as Record<string, unknown>;
    expect(Object.keys(t).filter((k) => k.startsWith("eject"))).toEqual([]);
    expect(t.exp).toBe(segundos(em(35)));
  });
});

describe("primeiroNome", () => {
  it("corta no primeiro espaço", () => {
    expect(primeiroNome("Mariana Costa")).toBe("Mariana");
    expect(primeiroNome("Ana")).toBe("Ana");
  });
});
