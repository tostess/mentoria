import { describe, expect, it } from "vitest";
import {
  resumoDasRegras,
  DIAS,
  HorarioInvalido,
  cabemPorSemana,
  ehDiaDaSemana,
  paraMinutos,
  paraTexto,
  resumoDaRotina,
} from "./horarios";

/**
 * A tradução entre o que o Parceiro digita e o que o banco guarda.
 *
 * Parece conta boba e é a que erra em `24:00`, em `9:5` e em campo vazio — os
 * três chegam de um `<input type="time">` real, por navegador antigo ou por
 * POST forjado.
 */

describe("paraMinutos", () => {
  it("converte hora do dia", () => {
    expect(paraMinutos("00:00")).toBe(0);
    expect(paraMinutos("09:30")).toBe(570);
    expect(paraMinutos("23:59")).toBe(1439);
  });

  it("aceita hora sem zero à esquerda", () => {
    expect(paraMinutos("9:30")).toBe(570);
  });

  it("apara espaço", () => {
    expect(paraMinutos("  09:30 ")).toBe(570);
  });

  it("recusa hora fora do relógio", () => {
    expect(() => paraMinutos("24:00")).toThrow(HorarioInvalido);
    expect(() => paraMinutos("09:60")).toThrow(HorarioInvalido);
  });

  it("recusa formato quebrado e campo vazio", () => {
    expect(() => paraMinutos("9:5")).toThrow(HorarioInvalido);
    expect(() => paraMinutos("930")).toThrow(HorarioInvalido);
    expect(() => paraMinutos("")).toThrow(/vazio/);
  });
});

describe("paraTexto", () => {
  it("põe zero à esquerda nos dois campos", () => {
    expect(paraTexto(0)).toBe("00:00");
    expect(paraTexto(570)).toBe("09:30");
    expect(paraTexto(1439)).toBe("23:59");
  });

  it("1440 é o fim do dia, não hora nenhuma", () => {
    expect(paraTexto(1440)).toBe("24:00");
  });

  it("volta ao valor original", () => {
    for (const minutos of [0, 1, 59, 60, 570, 719, 1439]) {
      expect(paraMinutos(paraTexto(minutos))).toBe(minutos);
    }
  });
});

describe("DIAS", () => {
  it("começa no domingo, como o banco", () => {
    expect(DIAS[0].valor).toBe(0);
    expect(DIAS[0].longo).toBe("domingo");
    expect(DIAS[6].longo).toBe("sábado");
  });

  it("tem os sete", () => {
    expect(DIAS).toHaveLength(7);
  });
});

describe("ehDiaDaSemana", () => {
  it("aceita 0 a 6", () => {
    expect(ehDiaDaSemana(0)).toBe(true);
    expect(ehDiaDaSemana(6)).toBe(true);
  });

  it("recusa fora da faixa, fracionário e texto", () => {
    expect(ehDiaDaSemana(7)).toBe(false);
    expect(ehDiaDaSemana(-1)).toBe(false);
    expect(ehDiaDaSemana(1.5)).toBe(false);
    expect(ehDiaDaSemana("2")).toBe(false);
  });
});

describe("resumoDaRotina", () => {
  it("um dia só não ganha conjunção", () => {
    expect(resumoDaRotina([2], 540, 720)).toBe("Ter, das 09:00 às 12:00");
  });

  it("dois dias usam 'e'", () => {
    expect(resumoDaRotina([2, 4], 540, 720)).toBe("Ter e Qui, das 09:00 às 12:00");
  });

  it("três ou mais usam vírgula e 'e' no último", () => {
    expect(resumoDaRotina([1, 3, 5], 540, 720)).toBe("Seg, Qua e Sex, das 09:00 às 12:00");
  });

  it("ordena e descarta repetido", () => {
    expect(resumoDaRotina([5, 1, 5], 540, 720)).toBe("Seg e Sex, das 09:00 às 12:00");
  });

  it("sem dia nenhum diz isso", () => {
    expect(resumoDaRotina([], 540, 720)).toBe("Nenhum dia selecionado.");
  });
});

describe("cabemPorSemana", () => {
  it("multiplica a janela pelos dias", () => {
    expect(cabemPorSemana(2, 540, 720, 30)).toBe(12);
  });

  it("arredonda para baixo — meia sessão não cabe", () => {
    expect(cabemPorSemana(1, 540, 710, 30)).toBe(5);
  });

  it("janela menor que a sessão não cabe nenhuma", () => {
    expect(cabemPorSemana(3, 540, 560, 30)).toBe(0);
  });

  it("entrada degenerada devolve zero em vez de dividir por zero", () => {
    expect(cabemPorSemana(2, 540, 720, 0)).toBe(0);
    expect(cabemPorSemana(2, 720, 540, 30)).toBe(0);
  });
});

describe("resumoDasRegras", () => {
  it("faixas iguais viram uma frase só", () => {
    expect(
      resumoDasRegras([
        { diaDaSemana: 4, inicioMin: 540, fimMin: 720 },
        { diaDaSemana: 2, inicioMin: 540, fimMin: 720 },
      ]),
    ).toBe("Ter e Qui, das 09:00 às 12:00");
  });

  it("faixas diferentes aparecem dia a dia, em ordem", () => {
    expect(
      resumoDasRegras([
        { diaDaSemana: 4, inicioMin: 840, fimMin: 1020 },
        { diaDaSemana: 2, inicioMin: 540, fimMin: 720 },
      ]),
    ).toBe("Ter 09:00–12:00 · Qui 14:00–17:00");
  });

  it("sem regra, diz que não há horário", () => {
    expect(resumoDasRegras([])).toBe("Nenhum horário aberto.");
  });
});
