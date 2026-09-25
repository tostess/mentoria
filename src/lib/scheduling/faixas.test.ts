import { describe, expect, it } from "vitest";
import {
  MINUTOS_NO_DIA,
  aoDia,
  contem,
  duracao,
  ehValida,
  normalizar,
  seSobrepoem,
  subtrair,
  total,
  unir,
} from "./faixas";

/**
 * A aritmética de faixas. Invariante 1: o motor é puro e fica travado, e este é
 * o arquivo que o trava por baixo — tudo aqui é número, sem fuso e sem data.
 *
 * O que estes casos protegem não é a soma: é o comportamento que erra calado.
 * Faixa dividida em duas por um bloqueio no meio, faixas que se encostam e
 * precisam fundir, bloqueio que engole a faixa inteira. Nenhum deles levanta
 * exceção quando está errado — só produz horário a mais ou a menos na tela.
 */

const manha = { inicio: 540, fim: 720 }; // 9h–12h
const tarde = { inicio: 780, fim: 1020 }; // 13h–17h

describe("ehValida", () => {
  it("aceita faixa dentro do dia com duração positiva", () => {
    expect(ehValida(manha)).toBe(true);
    expect(ehValida({ inicio: 0, fim: MINUTOS_NO_DIA })).toBe(true);
  });

  it("recusa duração zero — fim é exclusivo, então 9h a 9h não é nada", () => {
    expect(ehValida({ inicio: 540, fim: 540 })).toBe(false);
  });

  it("recusa invertida, negativa e além do dia", () => {
    expect(ehValida({ inicio: 720, fim: 540 })).toBe(false);
    expect(ehValida({ inicio: -60, fim: 540 })).toBe(false);
    expect(ehValida({ inicio: 540, fim: 1500 })).toBe(false);
  });

  it("recusa fracionário — minuto é inteiro", () => {
    expect(ehValida({ inicio: 540.5, fim: 720 })).toBe(false);
  });
});

describe("aoDia", () => {
  it("recorta o que passa das bordas", () => {
    expect(aoDia({ inicio: -30, fim: 1500 })).toEqual({ inicio: 0, fim: MINUTOS_NO_DIA });
  });

  it("devolve null quando não sobra minuto nenhum", () => {
    expect(aoDia({ inicio: 1500, fim: 1600 })).toBeNull();
    expect(aoDia({ inicio: 540, fim: 540 })).toBeNull();
  });
});

describe("normalizar", () => {
  it("ordena", () => {
    expect(normalizar([tarde, manha])).toEqual([manha, tarde]);
  });

  it("funde o que se sobrepõe", () => {
    expect(normalizar([{ inicio: 540, fim: 720 }, { inicio: 660, fim: 780 }])).toEqual([
      { inicio: 540, fim: 780 },
    ]);
  });

  /**
   * O caso que importa: 9h–12h e 12h–15h têm de virar 9h–15h. Sem fundir
   * vizinhas, uma sessão de 30 minutos às 11h45 seria recusada por atravessar
   * uma fronteira que só existe no jeito como o Parceiro digitou.
   */
  it("funde faixas que apenas se encostam", () => {
    expect(normalizar([{ inicio: 540, fim: 720 }, { inicio: 720, fim: 900 }])).toEqual([
      { inicio: 540, fim: 900 },
    ]);
  });

  it("descarta faixa inválida em vez de propagá-la", () => {
    expect(normalizar([manha, { inicio: 720, fim: 600 }, { inicio: 0, fim: 0 }])).toEqual([manha]);
  });

  it("não modifica a entrada", () => {
    const entrada = [{ inicio: 540, fim: 720 }, { inicio: 700, fim: 780 }];
    const copia = structuredClone(entrada);
    normalizar(entrada);
    expect(entrada).toEqual(copia);
  });

  it("faixa que engole outra devolve só a maior", () => {
    expect(normalizar([{ inicio: 540, fim: 1020 }, { inicio: 600, fim: 700 }])).toEqual([
      { inicio: 540, fim: 1020 },
    ]);
  });
});

describe("subtrair", () => {
  it("bloqueio no meio divide a faixa em duas", () => {
    expect(subtrair([manha], [{ inicio: 600, fim: 630 }])).toEqual([
      { inicio: 540, fim: 600 },
      { inicio: 630, fim: 720 },
    ]);
  });

  it("bloqueio no começo apenas encurta", () => {
    expect(subtrair([manha], [{ inicio: 500, fim: 600 }])).toEqual([{ inicio: 600, fim: 720 }]);
  });

  it("bloqueio no fim apenas encurta", () => {
    expect(subtrair([manha], [{ inicio: 700, fim: 800 }])).toEqual([{ inicio: 540, fim: 700 }]);
  });

  it("bloqueio que cobre tudo apaga a faixa", () => {
    expect(subtrair([manha], [{ inicio: 0, fim: MINUTOS_NO_DIA }])).toEqual([]);
  });

  it("bloqueio que não toca a faixa deixa tudo", () => {
    expect(subtrair([manha], [{ inicio: 1200, fim: 1300 }])).toEqual([manha]);
  });

  it("dois bloqueios em faixas diferentes cortam cada um a sua", () => {
    expect(
      subtrair([manha, tarde], [{ inicio: 600, fim: 620 }, { inicio: 900, fim: 1020 }]),
    ).toEqual([
      { inicio: 540, fim: 600 },
      { inicio: 620, fim: 720 },
      { inicio: 780, fim: 900 },
    ]);
  });

  /** Encostar não é sobrepor: bloquear 12h–13h não tira minuto de 9h–12h. */
  it("bloqueio que só encosta na borda não remove nada", () => {
    expect(subtrair([manha], [{ inicio: 720, fim: 780 }])).toEqual([manha]);
  });

  it("bloqueios sobrepostos entre si não se atrapalham", () => {
    expect(
      subtrair([manha], [{ inicio: 600, fim: 650 }, { inicio: 630, fim: 680 }]),
    ).toEqual([
      { inicio: 540, fim: 600 },
      { inicio: 680, fim: 720 },
    ]);
  });

  it("sem bloqueio nenhum devolve a base normalizada", () => {
    expect(subtrair([tarde, manha], [])).toEqual([manha, tarde]);
  });
});

describe("unir", () => {
  it("junta e funde", () => {
    expect(unir([manha], [{ inicio: 720, fim: 780 }])).toEqual([{ inicio: 540, fim: 780 }]);
  });
});

describe("seSobrepoem e contem", () => {
  it("um minuto em comum já é sobreposição", () => {
    expect(seSobrepoem({ inicio: 540, fim: 600 }, { inicio: 599, fim: 700 })).toBe(true);
  });

  it("encostar não é sobrepor", () => {
    expect(seSobrepoem({ inicio: 540, fim: 600 }, { inicio: 600, fim: 700 })).toBe(false);
  });

  it("contem aceita as bordas", () => {
    expect(contem(manha, { inicio: 540, fim: 720 })).toBe(true);
    expect(contem(manha, { inicio: 540, fim: 721 })).toBe(false);
  });
});

describe("duracao e total", () => {
  it("duração é fim menos início", () => {
    expect(duracao(manha)).toBe(180);
  });

  it("total soma sem contar sobreposição duas vezes", () => {
    expect(total([manha, tarde])).toBe(420);
    expect(total([{ inicio: 540, fim: 720 }, { inicio: 600, fim: 780 }])).toBe(240);
  });

  it("total de nada é zero", () => {
    expect(total([])).toBe(0);
  });
});
