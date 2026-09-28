import { describe, expect, it } from "vitest";
import {
  chaveDoDia,
  cnpj,
  diaDaSemanaCurto,
  diaDaSemanaLongo,
  diaDoContrato,
  diaDoMes,
  hora,
  humanizar,
  intervalo,
  periodoDoContrato,
  prazoRestante,
  quandoRelativo,
  rotuloDoFuso,
} from "./formato";

/** Instante em São Paulo (UTC−3, sem horário de verão desde 2019). */
function sp(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

describe("quandoRelativo", () => {
  const agora = sp("2026-09-25T14:30:00");

  it("menos de um minuto é agora há pouco", () => {
    expect(quandoRelativo(sp("2026-09-25T14:29:01"), agora)).toBe("agora há pouco");
  });

  it("instante no futuro não vira minuto negativo", () => {
    expect(quandoRelativo(sp("2026-09-25T14:32:00"), agora)).toBe("agora há pouco");
  });

  it("um minuto cravado já conta", () => {
    expect(quandoRelativo(sp("2026-09-25T14:29:00"), agora)).toBe("há 1 min");
  });

  it("59 minutos ainda é relativo", () => {
    expect(quandoRelativo(sp("2026-09-25T13:31:00"), agora)).toBe("há 59 min");
  });

  it("uma hora ou mais no mesmo dia vira hoje com hora", () => {
    expect(quandoRelativo(sp("2026-09-25T09:05:00"), agora)).toBe("hoje, 09:05");
  });

  it("ontem é do calendário, não de 24 horas corridas", () => {
    const meiaNoiteEDez = sp("2026-09-26T00:10:00");
    expect(quandoRelativo(sp("2026-09-25T22:50:00"), meiaNoiteEDez)).toBe("ontem, 22:50");
  });

  it("o dia é o de São Paulo, não o de UTC", () => {
    // 23h de São Paulo já é dia seguinte em UTC.
    const noite = sp("2026-09-25T23:00:00");
    expect(quandoRelativo(sp("2026-09-25T21:00:00"), noite)).toBe("hoje, 21:00");
  });

  it("mais antigo que ontem mostra dia e mês", () => {
    expect(quandoRelativo(sp("2026-09-20T08:00:00"), agora)).toBe("20/09, 08:00");
  });

  it("outro ano mostra o ano", () => {
    expect(quandoRelativo(sp("2025-12-31T08:00:00"), agora)).toBe("31/12/2025, 08:00");
  });
});

describe("datas de contrato", () => {
  it("dia 1º não vira dia 31 do mês anterior", () => {
    expect(diaDoContrato("2026-09-01")).toBe("01/09/2026");
  });

  it("período cobre as quatro combinações", () => {
    expect(periodoDoContrato(null, null)).toBe("Contrato sem período registrado.");
    expect(periodoDoContrato("2026-09-01", "2027-08-31")).toBe(
      "Contrato de 01/09/2026 a 31/08/2027.",
    );
    expect(periodoDoContrato("2026-09-01", null)).toBe("Contrato a partir de 01/09/2026.");
    expect(periodoDoContrato(null, "2027-08-31")).toBe("Contrato até 31/08/2027.");
  });
});

describe("cnpj", () => {
  it("formata 14 dígitos", () => {
    expect(cnpj("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("deixa como veio o que não tem 14 dígitos", () => {
    expect(cnpj("123")).toBe("123");
    expect(cnpj(null)).toBe("sem CNPJ");
  });
});

describe("humanizar", () => {
  it("troca sublinhado por espaço e capitaliza", () => {
    expect(humanizar("alterar_status_parceiro")).toBe("Alterar status parceiro");
    expect(humanizar("no_show_partner")).toBe("No show partner");
  });
});

describe("agenda no fuso de quem olha", () => {
  // Terça 29/09/2026, 12:00Z = 9h em São Paulo.
  const INICIO = new Date("2026-09-29T12:00:00Z");
  const FIM = new Date("2026-09-29T12:30:00Z");

  it("mostra dia, hora e intervalo no fuso da tela por padrão", () => {
    expect(diaDaSemanaCurto(INICIO)).toBe("ter");
    expect(diaDaSemanaLongo(INICIO)).toBe("terça");
    expect(diaDoMes(INICIO)).toBe("29");
    expect(intervalo(INICIO, FIM)).toBe("ter, 29/09 · 09:00–09:30");
  });

  it("o mesmo instante muda de dia em outro fuso", () => {
    // 12:00Z é 21h de terça em Tóquio e 1h de quarta em Auckland (UTC+13 no verão de lá).
    expect(hora(INICIO, "Asia/Tokyo")).toBe("21:00");
    expect(chaveDoDia(INICIO, "Pacific/Auckland")).toBe("2026-09-30");
    expect(diaDaSemanaCurto(INICIO, "Pacific/Auckland")).toBe("qua");
  });

  it("domingo é o dia 0 da semana, como no banco", () => {
    expect(diaDaSemanaCurto(new Date("2026-09-27T15:00:00Z"))).toBe("dom");
  });

  it("nomeia o fuso de Brasília e deixa os outros legíveis", () => {
    expect(rotuloDoFuso("America/Sao_Paulo")).toBe("Horário de Brasília");
    expect(rotuloDoFuso("America/New_York")).toBe("America/New York");
  });

  it("prazo em horas, e em minutos quando falta menos de uma", () => {
    const agora = new Date("2026-09-27T12:00:00Z");
    expect(prazoRestante(new Date("2026-09-29T05:30:00Z"), agora)).toBe("expira em 41 h");
    expect(prazoRestante(new Date("2026-09-27T12:25:00Z"), agora)).toBe("expira em 25 min");
    expect(prazoRestante(new Date("2026-09-27T11:00:00Z"), agora)).toBe("expira em 0 min");
  });
});
