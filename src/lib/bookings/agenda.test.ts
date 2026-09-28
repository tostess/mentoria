import { describe, expect, it } from "vitest";
import { limiteDeResposta, separarAgenda, type SessaoNaAgenda } from "./agenda";

const AGORA = new Date("2026-09-29T12:10:00Z");

function sessao(id: string, inicioIso: string, status: string): SessaoNaAgenda {
  const inicio = new Date(inicioIso);
  return {
    id,
    inicio,
    fim: new Date(inicio.getTime() + 30 * 60_000),
    status,
    criadaEm: new Date("2026-09-25T12:00:00Z"),
    recusadaPeloParceiro: false,
    outro: { id: "x", nome: "X", foto: null, cargo: null, empresa: null },
  };
}

describe("separarAgenda", () => {
  const lista = [
    sessao("em-curso", "2026-09-29T12:00:00Z", "confirmed"),
    sessao("passou-sem-fechar", "2026-09-28T12:00:00Z", "confirmed"),
    sessao("depois", "2026-10-01T12:00:00Z", "confirmed"),
    sessao("pedido", "2026-10-06T13:00:00Z", "pending"),
    sessao("pedido-vencido", "2026-09-29T11:00:00Z", "pending"),
    sessao("recusada", "2026-09-30T12:00:00Z", "cancelled"),
  ];
  const r = separarAgenda(lista, AGORA);

  it("pedidos são os pendentes cujo horário ainda não chegou", () => {
    expect(r.pedidos.map((s) => s.id)).toEqual(["pedido"]);
  });

  it("próximas incluem a sessão em curso, em ordem de início", () => {
    expect(r.proximas.map((s) => s.id)).toEqual(["em-curso", "depois"]);
  });

  it("confirmada que já terminou vai para anteriores sem esperar o cron", () => {
    expect(r.anteriores.map((s) => s.id)).toEqual(["recusada", "pedido-vencido", "passou-sem-fechar"]);
  });
});

describe("limiteDeResposta", () => {
  const criadaEm = new Date("2026-09-25T12:00:00Z");

  it("é o prazo de horas quando a sessão está longe", () => {
    const inicio = new Date("2026-10-06T12:00:00Z");
    expect(limiteDeResposta({ criadaEm, inicio }, 48).toISOString()).toBe("2026-09-27T12:00:00.000Z");
  });

  it("é o início da sessão quando ela chega antes do prazo", () => {
    const inicio = new Date("2026-09-26T00:00:00Z");
    expect(limiteDeResposta({ criadaEm, inicio }, 48)).toEqual(inicio);
  });
});
