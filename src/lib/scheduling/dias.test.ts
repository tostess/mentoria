import { describe, expect, it } from "vitest";
import { diaDaSemanaDe, diasEntre, ehDataValida, faixasDoDia } from "./dias";
import type { Excecao, Parceiro, RegraSemanal } from "./tipos";

/**
 * De "toda terça das 9h às 12h" para "no dia 29/09, das 9h às 12h".
 *
 * Datas de referência, conferidas: 27/09/2026 é domingo, 28 é segunda, 29 é
 * terça, 30 é quarta.
 */

const TERCA = 2;

function parceiro(regras: RegraSemanal[], excecoes: Excecao[] = []): Parceiro {
  return { fuso: "America/Sao_Paulo", bufferMin: 15, maxPorSemana: 4, regras, excecoes };
}

const tercaDeManha: RegraSemanal = {
  diaDaSemana: TERCA,
  inicioMin: 540,
  fimMin: 720,
  valeDe: null,
  valeAte: null,
};

describe("diaDaSemanaDe", () => {
  it("usa 0 para domingo, como o banco", () => {
    expect(diaDaSemanaDe("2026-09-27")).toBe(0);
    expect(diaDaSemanaDe("2026-09-28")).toBe(1);
    expect(diaDaSemanaDe("2026-09-29")).toBe(2);
  });

  /**
   * `new Date("2026-09-29")` é meia-noite **UTC**, que em São Paulo é dia 28 —
   * a data trocaria de dia da semana conforme o fuso do servidor. Aqui não há
   * fuso envolvido, e o resultado não pode depender de onde o código roda.
   */
  it("não depende do fuso do processo", () => {
    const antes = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      expect(diaDaSemanaDe("2026-09-29")).toBe(2);
      process.env.TZ = "Pacific/Niue";
      expect(diaDaSemanaDe("2026-09-29")).toBe(2);
    } finally {
      process.env.TZ = antes;
    }
  });

  it("recusa o que não é data ISO", () => {
    expect(() => diaDaSemanaDe("29/09/2026")).toThrow(/data local inválida/);
    expect(() => diaDaSemanaDe("2026-9-29")).toThrow(/data local inválida/);
  });
});

describe("ehDataValida", () => {
  it("recusa dia que não existe no mês", () => {
    expect(ehDataValida("2026-02-31")).toBe(false);
    expect(ehDataValida("2026-02-28")).toBe(true);
  });

  it("acerta ano bissexto", () => {
    expect(ehDataValida("2028-02-29")).toBe(true);
    expect(ehDataValida("2026-02-29")).toBe(false);
  });
});

describe("faixasDoDia — a regra semanal", () => {
  it("abre no dia da semana da regra", () => {
    expect(faixasDoDia(parceiro([tercaDeManha]), "2026-09-29")).toEqual([
      { inicio: 540, fim: 720 },
    ]);
  });

  it("não abre nos outros dias", () => {
    expect(faixasDoDia(parceiro([tercaDeManha]), "2026-09-28")).toEqual([]);
    expect(faixasDoDia(parceiro([tercaDeManha]), "2026-09-30")).toEqual([]);
  });

  it("duas regras no mesmo dia viram duas faixas", () => {
    const p = parceiro([tercaDeManha, { ...tercaDeManha, inicioMin: 780, fimMin: 1020 }]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([
      { inicio: 540, fim: 720 },
      { inicio: 780, fim: 1020 },
    ]);
  });

  it("duas regras encostadas fundem numa faixa só", () => {
    const p = parceiro([tercaDeManha, { ...tercaDeManha, inicioMin: 720, fimMin: 900 }]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([{ inicio: 540, fim: 900 }]);
  });

  it("sem regra nenhuma, nada abre", () => {
    expect(faixasDoDia(parceiro([]), "2026-09-29")).toEqual([]);
  });

  it("recusa data inválida em vez de devolver lista vazia", () => {
    expect(() => faixasDoDia(parceiro([tercaDeManha]), "2026-02-31")).toThrow(
      /data local inválida/,
    );
  });
});

describe("faixasDoDia — vigência da regra", () => {
  it("regra que ainda não começou não vale", () => {
    const p = parceiro([{ ...tercaDeManha, valeDe: "2026-10-01" }]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([]);
    expect(faixasDoDia(p, "2026-10-06")).toEqual([{ inicio: 540, fim: 720 }]);
  });

  it("regra encerrada não vale", () => {
    const p = parceiro([{ ...tercaDeManha, valeAte: "2026-09-28" }]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([]);
    expect(faixasDoDia(p, "2026-09-22")).toEqual([{ inicio: 540, fim: 720 }]);
  });

  /** As datas de vigência são inclusivas nas duas pontas. */
  it("vale no primeiro e no último dia da vigência", () => {
    const p = parceiro([{ ...tercaDeManha, valeDe: "2026-09-29", valeAte: "2026-09-29" }]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([{ inicio: 540, fim: 720 }]);
    expect(faixasDoDia(p, "2026-10-06")).toEqual([]);
  });

  /**
   * O caso de uso da vigência: trocar a rotina sem apagar o histórico. A regra
   * antiga ganha `valeAte` e a nova começa no dia seguinte — e nenhum dos dois
   * dias fica com as duas valendo.
   */
  it("troca de rotina não sobrepõe as duas regras", () => {
    const p = parceiro([
      { ...tercaDeManha, valeAte: "2026-09-29" },
      { ...tercaDeManha, inicioMin: 840, fimMin: 1020, valeDe: "2026-09-30" },
    ]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([{ inicio: 540, fim: 720 }]);
    expect(faixasDoDia(p, "2026-10-06")).toEqual([{ inicio: 840, fim: 1020 }]);
  });
});

describe("faixasDoDia — exceções", () => {
  it("extra abre horário num dia sem regra", () => {
    const p = parceiro([tercaDeManha], [
      { dia: "2026-09-30", tipo: "extra", inicioMin: 600, fimMin: 660 },
    ]);
    expect(faixasDoDia(p, "2026-09-30")).toEqual([{ inicio: 600, fim: 660 }]);
  });

  it("extra encostado na regra funde com ela", () => {
    const p = parceiro([tercaDeManha], [
      { dia: "2026-09-29", tipo: "extra", inicioMin: 720, fimMin: 780 },
    ]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([{ inicio: 540, fim: 780 }]);
  });

  it("bloqueio com faixa corta só aquele pedaço", () => {
    const p = parceiro([tercaDeManha], [
      { dia: "2026-09-29", tipo: "bloqueio", inicioMin: 600, fimMin: 630 },
    ]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([
      { inicio: 540, fim: 600 },
      { inicio: 630, fim: 720 },
    ]);
  });

  /** Bloqueio sem faixa é o dia inteiro — é assim que se marca férias. */
  it("bloqueio sem faixa fecha o dia todo", () => {
    const p = parceiro([tercaDeManha], [
      { dia: "2026-09-29", tipo: "bloqueio", inicioMin: null, fimMin: null },
    ]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([]);
  });

  /**
   * Extra sem faixa é ignorado de propósito. Abrir "o dia inteiro" por causa de
   * dois campos vazios seria um estrago silencioso; quem quer o dia todo digita
   * 0 a 1440.
   */
  it("extra sem faixa é ignorado, não abre o dia", () => {
    const p = parceiro([], [{ dia: "2026-09-30", tipo: "extra", inicioMin: null, fimMin: null }]);
    expect(faixasDoDia(p, "2026-09-30")).toEqual([]);
  });

  /**
   * Bloqueio depois de extra: férias vencem um extra marcado para o mesmo dia.
   * A ordem inversa deixaria o Parceiro atender no meio das férias por causa de
   * um horário extra esquecido.
   */
  it("bloqueio do dia inteiro apaga até o extra daquele dia", () => {
    const p = parceiro(
      [tercaDeManha],
      [
        { dia: "2026-09-29", tipo: "extra", inicioMin: 1200, fimMin: 1260 },
        { dia: "2026-09-29", tipo: "bloqueio", inicioMin: null, fimMin: null },
      ],
    );
    expect(faixasDoDia(p, "2026-09-29")).toEqual([]);
  });

  it("exceção de outro dia não interfere", () => {
    const p = parceiro([tercaDeManha], [
      { dia: "2026-09-28", tipo: "bloqueio", inicioMin: null, fimMin: null },
    ]);
    expect(faixasDoDia(p, "2026-09-29")).toEqual([{ inicio: 540, fim: 720 }]);
  });

  it("faixa de exceção fora do dia é recortada", () => {
    const p = parceiro([], [{ dia: "2026-09-30", tipo: "extra", inicioMin: 1400, fimMin: 1600 }]);
    expect(faixasDoDia(p, "2026-09-30")).toEqual([{ inicio: 1400, fim: 1440 }]);
  });
});

describe("diasEntre", () => {
  it("inclui as duas pontas", () => {
    expect(diasEntre("2026-09-28", "2026-09-30")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
  });

  it("um dia só quando as pontas são iguais", () => {
    expect(diasEntre("2026-09-28", "2026-09-28")).toEqual(["2026-09-28"]);
  });

  it("vazio quando o fim vem antes do início", () => {
    expect(diasEntre("2026-09-30", "2026-09-28")).toEqual([]);
  });

  it("atravessa a virada do mês", () => {
    expect(diasEntre("2026-09-30", "2026-10-02")).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("atravessa 29 de fevereiro em ano bissexto", () => {
    expect(diasEntre("2028-02-28", "2028-03-01")).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("o horizonte de 14 dias devolve 15 datas", () => {
    expect(diasEntre("2026-09-25", "2026-10-09")).toHaveLength(15);
  });

  it("recusa data inválida", () => {
    expect(() => diasEntre("2026-02-31", "2026-03-02")).toThrow(/intervalo de datas inválido/);
  });
});
