import { describe, expect, it } from "vitest";
import { CampoInvalido } from "@/lib/forms";
import {
  MAX_DIAS_DE_FOLGA,
  MAX_FAIXAS_POR_DIA,
  agruparFolgas,
  lerGrade,
  linhasDaFolga,
  noRelogio,
  rotuloDaFolga,
  sessoesNoBloqueio,
  validarGrade,
  type FaixaDaGrade,
} from "./grade";

/**
 * A grade semanal e as folgas, entre o formulário e o banco.
 *
 * Tudo que é recusado aqui tem de ser `CampoInvalido`: é o único erro que a
 * Server Action transforma em frase. Um `HorarioInvalido` escapando viraria
 * 500 numa hora mal digitada.
 */

const TER = 2 as const;
const QUI = 4 as const;

describe("lerGrade", () => {
  it("lê o que o componente serializa", () => {
    expect(lerGrade(JSON.stringify([{ dia: TER, inicio: "09:00", fim: "12:00" }]))).toEqual([
      { dia: TER, inicioMin: 540, fimMin: 720 },
    ]);
  });

  it("grade vazia é grade válida", () => {
    expect(lerGrade("[]")).toEqual([]);
  });

  it("recusa o que não é JSON nem lista, com frase", () => {
    expect(() => lerGrade("{")).toThrow(CampoInvalido);
    expect(() => lerGrade("{}")).toThrow(CampoInvalido);
    expect(() => lerGrade("[null]")).toThrow(CampoInvalido);
  });

  it("recusa dia fora da semana", () => {
    expect(() => lerGrade(JSON.stringify([{ dia: 7, inicio: "09:00", fim: "12:00" }]))).toThrow(
      CampoInvalido,
    );
    expect(() => lerGrade(JSON.stringify([{ dia: "2", inicio: "09:00", fim: "12:00" }]))).toThrow(
      CampoInvalido,
    );
  });

  it("hora inválida vira CampoInvalido, não HorarioInvalido", () => {
    expect(() => lerGrade(JSON.stringify([{ dia: TER, inicio: "25:00", fim: "12:00" }]))).toThrow(
      CampoInvalido,
    );
    expect(() => lerGrade(JSON.stringify([{ dia: TER, inicio: "", fim: "12:00" }]))).toThrow(
      CampoInvalido,
    );
    expect(() => lerGrade(JSON.stringify([{ dia: TER, fim: "12:00" }]))).toThrow(CampoInvalido);
  });
});

describe("validarGrade", () => {
  const faixa = (dia: FaixaDaGrade["dia"], inicioMin: number, fimMin: number): FaixaDaGrade => ({
    dia,
    inicioMin,
    fimMin,
  });

  it("ordena por dia e hora", () => {
    expect(
      validarGrade([faixa(QUI, 840, 1020), faixa(TER, 840, 1020), faixa(TER, 540, 720)], 30),
    ).toEqual([faixa(TER, 540, 720), faixa(TER, 840, 1020), faixa(QUI, 840, 1020)]);
  });

  it("aceita horário diferente por dia — o que o modo rápido não fazia", () => {
    expect(validarGrade([faixa(TER, 540, 720), faixa(QUI, 840, 1020)], 30)).toHaveLength(2);
  });

  it("recusa término antes do início, dizendo o dia", () => {
    expect(() => validarGrade([faixa(TER, 720, 540)], 30)).toThrow(/terça-feira/);
  });

  it("recusa faixa menor que uma sessão", () => {
    expect(() => validarGrade([faixa(TER, 540, 555)], 30)).toThrow(/pelo menos 30 minutos/);
    expect(validarGrade([faixa(TER, 540, 570)], 30)).toHaveLength(1);
  });

  it("recusa faixas sobrepostas no mesmo dia", () => {
    expect(() => validarGrade([faixa(TER, 540, 720), faixa(TER, 660, 780)], 30)).toThrow(
      /09:00–12:00 e 11:00–13:00 se sobrepõem/,
    );
  });

  it("faixas encostadas passam, e a mesma faixa em dias diferentes também", () => {
    expect(validarGrade([faixa(TER, 540, 720), faixa(TER, 720, 840)], 30)).toHaveLength(2);
    expect(validarGrade([faixa(TER, 540, 720), faixa(QUI, 540, 720)], 30)).toHaveLength(2);
  });

  it("limita as faixas por dia", () => {
    const muitas = Array.from({ length: MAX_FAIXAS_POR_DIA + 1 }, (_, i) =>
      faixa(TER, i * 60, i * 60 + 30),
    );
    expect(() => validarGrade(muitas, 30)).toThrow(CampoInvalido);
    expect(validarGrade(muitas.slice(0, MAX_FAIXAS_POR_DIA), 30)).toHaveLength(MAX_FAIXAS_POR_DIA);
  });
});

describe("linhasDaFolga", () => {
  const HOJE = "2026-10-01";

  it("férias viram uma linha por dia, dia inteiro", () => {
    const linhas = linhasDaFolga(
      { tipo: "bloqueio", de: "2026-10-12", ate: "2026-10-14", inicioMin: null, fimMin: null },
      HOJE,
      30,
    );
    expect(linhas).toEqual([
      { dia: "2026-10-12", tipo: "bloqueio", inicioMin: null, fimMin: null },
      { dia: "2026-10-13", tipo: "bloqueio", inicioMin: null, fimMin: null },
      { dia: "2026-10-14", tipo: "bloqueio", inicioMin: null, fimMin: null },
    ]);
  });

  it("bloqueio de uma faixa em vários dias leva a faixa em cada um", () => {
    const linhas = linhasDaFolga(
      { tipo: "bloqueio", de: "2026-10-12", ate: "2026-10-13", inicioMin: 540, fimMin: 720 },
      HOJE,
      30,
    );
    expect(linhas.map((l) => [l.dia, l.inicioMin, l.fimMin])).toEqual([
      ["2026-10-12", 540, 720],
      ["2026-10-13", 540, 720],
    ]);
  });

  it("bloqueio de faixa curta passa — fechar 15 minutos é escolha dele", () => {
    expect(
      linhasDaFolga(
        { tipo: "bloqueio", de: HOJE, ate: HOJE, inicioMin: 540, fimMin: 555 },
        HOJE,
        30,
      ),
    ).toHaveLength(1);
  });

  it("extra vale num dia só, mesmo que chegue um término", () => {
    const linhas = linhasDaFolga(
      { tipo: "extra", de: "2026-10-17", ate: "2026-10-30", inicioMin: 540, fimMin: 720 },
      HOJE,
      30,
    );
    expect(linhas).toEqual([{ dia: "2026-10-17", tipo: "extra", inicioMin: 540, fimMin: 720 }]);
  });

  it("extra sem faixa é recusado — o motor ignoraria em silêncio", () => {
    expect(() =>
      linhasDaFolga(
        { tipo: "extra", de: "2026-10-17", ate: "2026-10-17", inicioMin: null, fimMin: null },
        HOJE,
        30,
      ),
    ).toThrow(CampoInvalido);
  });

  it("extra menor que uma sessão é recusado", () => {
    expect(() =>
      linhasDaFolga(
        { tipo: "extra", de: "2026-10-17", ate: "2026-10-17", inicioMin: 540, fimMin: 555 },
        HOJE,
        30,
      ),
    ).toThrow(/pelo menos 30 minutos/);
  });

  it("recusa passado, período ao contrário, data inexistente e faixa invertida", () => {
    const base = { tipo: "bloqueio" as const, inicioMin: null, fimMin: null };
    expect(() => linhasDaFolga({ ...base, de: "2026-09-30", ate: "2026-10-02" }, HOJE, 30)).toThrow(
      /já passou/,
    );
    expect(() => linhasDaFolga({ ...base, de: "2026-10-05", ate: "2026-10-02" }, HOJE, 30)).toThrow(
      CampoInvalido,
    );
    expect(() => linhasDaFolga({ ...base, de: "2026-02-31", ate: "2026-03-02" }, "2026-01-01", 30)).toThrow(
      CampoInvalido,
    );
    expect(() =>
      linhasDaFolga({ ...base, de: HOJE, ate: HOJE, inicioMin: 720, fimMin: 540 }, HOJE, 30),
    ).toThrow(CampoInvalido);
  });

  it("hoje ainda vale", () => {
    expect(
      linhasDaFolga({ tipo: "bloqueio", de: HOJE, ate: HOJE, inicioMin: null, fimMin: null }, HOJE, 30),
    ).toHaveLength(1);
  });

  it("limita o tamanho do período", () => {
    const base = { tipo: "bloqueio" as const, inicioMin: null, fimMin: null };
    expect(() => linhasDaFolga({ ...base, de: "2026-10-01", ate: "2027-01-01" }, HOJE, 30)).toThrow(
      CampoInvalido,
    );
    expect(linhasDaFolga({ ...base, de: "2026-10-01", ate: "2026-12-31" }, HOJE, 30)).toHaveLength(
      MAX_DIAS_DE_FOLGA,
    );
  });
});

describe("agruparFolgas", () => {
  const bloqueio = (id: string, dia: string, inicioMin: number | null = null, fimMin: number | null = null) => ({
    id,
    dia,
    tipo: "bloqueio" as const,
    inicioMin,
    fimMin,
  });

  it("dias seguidos com a mesma folga viram um período", () => {
    expect(
      agruparFolgas([bloqueio("c", "2026-10-14"), bloqueio("a", "2026-10-12"), bloqueio("b", "2026-10-13")]),
    ).toEqual([
      { ids: ["a", "b", "c"], tipo: "bloqueio", de: "2026-10-12", ate: "2026-10-14", inicioMin: null, fimMin: null },
    ]);
  });

  it("vira o mês sem quebrar o período", () => {
    const [grupo] = agruparFolgas([bloqueio("a", "2026-10-31"), bloqueio("b", "2026-11-01")]);
    expect([grupo.de, grupo.ate]).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("buraco, faixa diferente ou tipo diferente separam", () => {
    const grupos = agruparFolgas([
      bloqueio("a", "2026-10-12"),
      bloqueio("b", "2026-10-14"),
      bloqueio("c", "2026-10-15", 540, 720),
      { id: "d", dia: "2026-10-15", tipo: "extra", inicioMin: 540, fimMin: 720 },
    ]);
    expect(grupos.map((g) => g.ids)).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("o mesmo dia repetido entra no mesmo grupo, para remover tudo de uma vez", () => {
    const grupos = agruparFolgas([bloqueio("a", "2026-10-12"), bloqueio("b", "2026-10-12")]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].ids).toEqual(["a", "b"]);
  });

  it("ordena a lista pela data", () => {
    const grupos = agruparFolgas([
      { id: "x", dia: "2026-10-20", tipo: "extra", inicioMin: 540, fimMin: 600 },
      bloqueio("y", "2026-10-02"),
    ]);
    expect(grupos.map((g) => g.de)).toEqual(["2026-10-02", "2026-10-20"]);
  });
});

describe("noRelogio", () => {
  it("põe o instante no dia e na hora do fuso", () => {
    // 02:30Z do dia 13 é 23:30 do dia 12 em São Paulo.
    expect(noRelogio(new Date("2026-10-13T02:30:00Z"), "America/Sao_Paulo")).toEqual({
      dia: "2026-10-12",
      minuto: 23 * 60 + 30,
    });
    expect(noRelogio(new Date("2026-10-13T00:00:00Z"), "Europe/Lisbon")).toEqual({
      dia: "2026-10-13",
      minuto: 60,
    });
  });

  it("meia-noite é 0, não 24", () => {
    expect(noRelogio(new Date("2026-10-13T03:00:00Z"), "America/Sao_Paulo").minuto).toBe(0);
  });
});

describe("sessoesNoBloqueio", () => {
  const sessao = (dia: string, inicio: number, fim = inicio + 30) => ({
    inicio: { dia, minuto: inicio },
    fim: { dia, minuto: fim },
  });
  const ferias = { tipo: "bloqueio" as const, de: "2026-10-12", ate: "2026-10-14", inicioMin: null, fimMin: null };

  it("conta as sessões dentro do período", () => {
    expect(
      sessoesNoBloqueio(ferias, [sessao("2026-10-11", 540), sessao("2026-10-12", 540), sessao("2026-10-14", 1000)]),
    ).toBe(2);
  });

  it("bloqueio de faixa só conta quem cruza a faixa", () => {
    const manha = { ...ferias, inicioMin: 540, fimMin: 720 };
    expect(
      sessoesNoBloqueio(manha, [
        sessao("2026-10-12", 510), // 8h30–9h: encosta, não cruza
        sessao("2026-10-12", 525), // 8h45–9h15: cruza
        sessao("2026-10-12", 720), // 12h: depois
      ]),
    ).toBe(1);
  });

  it("horário extra não esconde sessão nenhuma", () => {
    expect(sessoesNoBloqueio({ ...ferias, tipo: "extra" }, [sessao("2026-10-12", 540)])).toBe(0);
  });
});

describe("rotuloDaFolga", () => {
  it("período com dia da semana, e dia inteiro", () => {
    expect(rotuloDaFolga({ de: "2026-10-12", ate: "2026-10-16", inicioMin: null, fimMin: null })).toEqual({
      periodo: "Seg 12/10 a Sex 16/10",
      faixa: "dia inteiro",
    });
  });

  it("um dia só, com faixa", () => {
    expect(rotuloDaFolga({ de: "2026-10-17", ate: "2026-10-17", inicioMin: 540, fimMin: 720 })).toEqual({
      periodo: "Sáb 17/10",
      faixa: "09:00–12:00",
    });
  });
});
