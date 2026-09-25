import { describe, expect, it } from "vitest";
import {
  avaliarSlots,
  chaveDaSemana,
  instanteLocal,
  proximoSlot,
  slotsDisponiveis,
  type Entrada,
} from "./slots";
import type { Limites, Ocupacao, Parceiro, RegraSemanal, Slot } from "./tipos";

/**
 * O motor, travado por teste (invariante 1).
 *
 * `agora` é sempre parâmetro, nunca `new Date()`: motor que olha o relógio não
 * se testa. O instante de referência é **2026-09-25T12:00:00Z**, que em São
 * Paulo (UTC−3, sem horário de verão desde 2019) é sexta-feira, 9h.
 *
 * Com aviso mínimo de 12h, nada antes de sexta 21h local entra. Com horizonte
 * de 14 dias, nada depois de 09/10 entra. As terças da janela são 29/09 e
 * 06/10.
 */

const AGORA = new Date("2026-09-25T12:00:00Z");
const SP = "America/Sao_Paulo";
const TERCA = 2;

const LIMITES: Limites = {
  horizonteDias: 14,
  avisoMinimoHoras: 12,
  duracaoMin: 30,
  passoMin: 30,
};

const tercaDeManha: RegraSemanal = {
  diaDaSemana: TERCA,
  inicioMin: 540,
  fimMin: 720,
  valeDe: null,
  valeAte: null,
};

function parceiro(ajustes: Partial<Parceiro> = {}): Parceiro {
  return {
    fuso: SP,
    bufferMin: 15,
    maxPorSemana: 4,
    regras: [tercaDeManha],
    excecoes: [],
    ...ajustes,
  };
}

function entrada(ajustes: Partial<Entrada> = {}): Entrada {
  return {
    agora: AGORA,
    parceiro: parceiro(),
    ocupacoes: [],
    limites: LIMITES,
    ...ajustes,
  };
}

/** Horários como o Parceiro os veria no relógio dele. Só para ler o teste. */
function emSaoPaulo(slots: readonly Slot[]): string[] {
  return slots.map((slot) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: SP,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(slot.inicio),
  );
}

function recusas(entradaDoTeste: Entrada): Record<string, number> {
  const conta: Record<string, number> = {};
  for (const { recusa } of avaliarSlots(entradaDoTeste)) {
    const chave = recusa ?? "livre";
    conta[chave] = (conta[chave] ?? 0) + 1;
  }
  return conta;
}

describe("instanteLocal", () => {
  it("converte minutos locais no instante certo", () => {
    expect(instanteLocal("2026-09-29", 540, SP)?.toISOString()).toBe("2026-09-29T12:00:00.000Z");
  });

  it("meia-noite é zero minuto", () => {
    expect(instanteLocal("2026-09-29", 0, SP)?.toISOString()).toBe("2026-09-29T03:00:00.000Z");
  });

  it("1440 é meia-noite do dia seguinte", () => {
    expect(instanteLocal("2026-09-29", 1440, SP)?.toISOString()).toBe("2026-09-30T03:00:00.000Z");
  });

  /**
   * Em Nova York, o relógio pula das 2h para as 3h em 08/03/2026 — das 2h às
   * 2h59 não houve. Luxon, pedido esse horário, empurra para a frente em vez de
   * recusar; sem a conferência, o motor ofereceria um horário que a tela
   * mostraria como outro.
   */
  it("devolve null para hora que não existiu (virada do horário de verão)", () => {
    expect(instanteLocal("2026-03-08", 150, "America/New_York")).toBeNull();
    expect(instanteLocal("2026-03-08", 90, "America/New_York")).not.toBeNull();
    expect(instanteLocal("2026-03-08", 180, "America/New_York")).not.toBeNull();
  });

  /** Na virada para trás a hora acontece duas vezes; Luxon fica com a primeira. */
  it("escolhe a primeira ocorrência de hora ambígua", () => {
    const ambigua = instanteLocal("2026-11-01", 90, "America/New_York");
    expect(ambigua?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("recusa fuso que não existe", () => {
    expect(() => instanteLocal("2026-09-29", 540, "Marte/Olympus")).toThrow(/fuso inválido/);
  });
});

describe("chaveDaSemana", () => {
  /**
   * Domingo e não segunda: `partner_rules.weekday` usa 0 para domingo, e contar
   * a carga numa fronteira e escrever a regra em outra faria "4 sessões por
   * semana" significar duas coisas.
   */
  it("agrupa de domingo a sábado", () => {
    const domingo = new Date("2026-09-27T15:00:00Z");
    const terca = new Date("2026-09-29T12:00:00Z");
    const sabado = new Date("2026-10-03T15:00:00Z");
    expect(chaveDaSemana(domingo, SP)).toBe("2026-09-27");
    expect(chaveDaSemana(terca, SP)).toBe("2026-09-27");
    expect(chaveDaSemana(sabado, SP)).toBe("2026-09-27");
  });

  it("o domingo seguinte já é outra semana", () => {
    expect(chaveDaSemana(new Date("2026-10-04T15:00:00Z"), SP)).toBe("2026-10-04");
  });

  /** A semana é a do Parceiro. O mesmo instante cai em semanas diferentes. */
  it("usa o fuso do Parceiro, não o do servidor", () => {
    // Domingo 00h30 em São Paulo é ainda sábado 23h30 em Nova York.
    const instante = new Date("2026-10-04T03:30:00Z");
    expect(chaveDaSemana(instante, SP)).toBe("2026-10-04");
    expect(chaveDaSemana(instante, "America/New_York")).toBe("2026-09-27");
  });
});

describe("a grade básica", () => {
  it("uma faixa de 3h com sessões de 30min dá 6 horários", () => {
    const slots = slotsDisponiveis(entrada());
    expect(emSaoPaulo(slots.slice(0, 6))).toEqual([
      "29/09, 09:00",
      "29/09, 09:30",
      "29/09, 10:00",
      "29/09, 10:30",
      "29/09, 11:00",
      "29/09, 11:30",
    ]);
  });

  it("abre as duas terças da janela de 14 dias", () => {
    const slots = slotsDisponiveis(entrada());
    expect(slots).toHaveLength(12);
    expect(emSaoPaulo(slots).at(-1)).toBe("06/10, 11:30");
  });

  it("o último horário cabe inteiro na faixa — 11h30 termina às 12h", () => {
    const slots = slotsDisponiveis(entrada());
    const ultimo = slots[5];
    expect(ultimo.fim.toISOString()).toBe("2026-09-29T15:00:00.000Z");
  });

  it("faixa curta demais para uma sessão não gera horário", () => {
    const p = parceiro({ regras: [{ ...tercaDeManha, inicioMin: 540, fimMin: 560 }] });
    expect(slotsDisponiveis(entrada({ parceiro: p }))).toEqual([]);
  });

  it("sem regra nenhuma não há horário", () => {
    expect(slotsDisponiveis(entrada({ parceiro: parceiro({ regras: [] }) }))).toEqual([]);
  });

  it("passo menor que a duração produz horários sobrepostos, se pedido", () => {
    const slots = slotsDisponiveis(entrada({ limites: { ...LIMITES, passoMin: 15 } }));
    expect(emSaoPaulo(slots.slice(0, 3))).toEqual(["29/09, 09:00", "29/09, 09:15", "29/09, 09:30"]);
  });

  it("passo zero cai na duração, em vez de girar para sempre", () => {
    const slots = slotsDisponiveis(entrada({ limites: { ...LIMITES, passoMin: 0 } }));
    expect(slots).toHaveLength(12);
  });

  it("os horários saem em ordem cronológica", () => {
    const slots = slotsDisponiveis(entrada());
    const tempos = slots.map((s) => s.inicio.getTime());
    expect(tempos).toEqual([...tempos].sort((a, b) => a - b));
  });
});

describe("aviso mínimo e horizonte", () => {
  /**
   * Sexta 9h local + 12h de aviso = sexta 21h, então a manhã de hoje não vale.
   *
   * A janela pega três sextas: 25/09 (hoje, barrada pelo aviso), 02/10 inteira,
   * e 09/10, que é exatamente o fim do horizonte — `agora + 14 dias` cai às 9h
   * daquele dia. O horário das 9h entra e os cinco seguintes não. Contar essa
   * ponta é o motivo de o teste existir: ela é fácil de errar por um.
   */
  it("recusa horário dentro do aviso mínimo", () => {
    const sexta: RegraSemanal = { ...tercaDeManha, diaDaSemana: 5 };
    const p = parceiro({ regras: [sexta] });
    const conta = recusas(entrada({ parceiro: p }));
    expect(conta["fora-do-aviso-minimo"]).toBe(6); // 25/09
    expect(conta["fora-do-horizonte"]).toBe(5); // 09/10, tirando as 9h
    expect(conta.livre).toBe(7); // 02/10 inteira, mais as 9h de 09/10
  });

  /** O instante exato do horizonte ainda vale — `agora + 14 dias` é o limite. */
  it("o horário na borda do horizonte entra", () => {
    const sexta: RegraSemanal = { ...tercaDeManha, diaDaSemana: 5 };
    const slots = slotsDisponiveis(entrada({ parceiro: parceiro({ regras: [sexta] }) }));
    expect(emSaoPaulo(slots).at(-1)).toBe("09/10, 09:00");
  });

  it("aviso mínimo zero libera o mesmo dia", () => {
    const sexta: RegraSemanal = { ...tercaDeManha, diaDaSemana: 5 };
    const slots = slotsDisponiveis(
      entrada({
        parceiro: parceiro({ regras: [sexta] }),
        limites: { ...LIMITES, avisoMinimoHoras: 0 },
      }),
    );
    // 9h local é exatamente `agora`; o horizonte cobre 25/09 e 02/10.
    expect(emSaoPaulo(slots)[0]).toBe("25/09, 09:00");
  });

  it("horizonte curto corta a segunda terça", () => {
    const slots = slotsDisponiveis(entrada({ limites: { ...LIMITES, horizonteDias: 7 } }));
    expect(slots).toHaveLength(6);
    expect(emSaoPaulo(slots).at(-1)).toBe("29/09, 11:30");
  });

  it("horizonte zero não abre nada", () => {
    expect(slotsDisponiveis(entrada({ limites: { ...LIMITES, horizonteDias: 0 } }))).toEqual([]);
  });
});

describe("o que já está marcado", () => {
  const ocupacao = (inicioISO: string, minutos = 30): Ocupacao => ({
    inicio: new Date(inicioISO),
    fim: new Date(new Date(inicioISO).getTime() + minutos * 60_000),
  });

  it("horário ocupado sai da lista", () => {
    const slots = slotsDisponiveis(
      entrada({ ocupacoes: [ocupacao("2026-09-29T12:00:00Z")] }),
    );
    expect(emSaoPaulo(slots)).not.toContain("29/09, 09:00");
  });

  /**
   * O descanso é o que separa "ocupado" de "colado demais". Com buffer de 15min
   * e uma sessão às 9h, o horário das 9h30 começaria zero minuto depois dela.
   */
  it("descanso derruba o horário imediatamente depois", () => {
    const slots = emSaoPaulo(
      slotsDisponiveis(entrada({ ocupacoes: [ocupacao("2026-09-29T12:00:00Z")] })),
    );
    expect(slots).not.toContain("29/09, 09:30");
    expect(slots).toContain("29/09, 10:00");
  });

  it("descanso derruba também o horário imediatamente antes", () => {
    const slots = emSaoPaulo(
      slotsDisponiveis(entrada({ ocupacoes: [ocupacao("2026-09-29T13:00:00Z")] })),
    );
    expect(slots).not.toContain("29/09, 09:30");
    expect(slots).toContain("29/09, 09:00");
  });

  it("buffer zero deixa as sessões encostarem", () => {
    const p = parceiro({ bufferMin: 0 });
    const slots = emSaoPaulo(
      slotsDisponiveis(
        entrada({ parceiro: p, ocupacoes: [ocupacao("2026-09-29T12:00:00Z")] }),
      ),
    );
    expect(slots).toContain("29/09, 09:30");
    expect(slots).not.toContain("29/09, 09:00");
  });

  it("sessão estendida de 60min ocupa os dois horários", () => {
    const slots = emSaoPaulo(
      slotsDisponiveis(entrada({ ocupacoes: [ocupacao("2026-09-29T12:00:00Z", 60)] })),
    );
    expect(slots).not.toContain("29/09, 09:00");
    expect(slots).not.toContain("29/09, 09:30");
    expect(slots).not.toContain("29/09, 10:00"); // descanso
    expect(slots).toContain("29/09, 10:30");
  });

  it("ocupação em outra semana não afeta esta terça", () => {
    const slots = emSaoPaulo(
      slotsDisponiveis(entrada({ ocupacoes: [ocupacao("2026-10-06T12:00:00Z")] })),
    );
    expect(slots).toContain("29/09, 09:00");
    expect(slots).not.toContain("06/10, 09:00");
  });

  it("distingue ocupado de descanso no diagnóstico", () => {
    const conta = recusas(entrada({ ocupacoes: [ocupacao("2026-09-29T12:00:00Z")] }));
    expect(conta.ocupado).toBe(1);
    expect(conta.descanso).toBe(1);
  });
});

describe("teto semanal", () => {
  const naSemana = (dia: string): Ocupacao => ({
    inicio: new Date(dia),
    fim: new Date(new Date(dia).getTime() + 30 * 60_000),
  });

  it("semana cheia não oferece horário nenhum", () => {
    const p = parceiro({ maxPorSemana: 2 });
    const slots = emSaoPaulo(
      slotsDisponiveis(
        entrada({
          parceiro: p,
          ocupacoes: [naSemana("2026-09-28T13:00:00Z"), naSemana("2026-09-30T13:00:00Z")],
        }),
      ),
    );
    expect(slots.filter((s) => s.startsWith("29/09"))).toEqual([]);
    // A semana seguinte segue livre.
    expect(slots.some((s) => s.startsWith("06/10"))).toBe(true);
  });

  it("uma vaga restante ainda abre a grade", () => {
    const p = parceiro({ maxPorSemana: 2 });
    const slots = emSaoPaulo(
      slotsDisponiveis(entrada({ parceiro: p, ocupacoes: [naSemana("2026-09-28T13:00:00Z")] })),
    );
    expect(slots.some((s) => s.startsWith("29/09"))).toBe(true);
  });

  /** O teto conta a semana do Parceiro, de domingo a sábado. */
  it("ocupação no sábado anterior conta para outra semana", () => {
    const p = parceiro({ maxPorSemana: 1 });
    // Sábado 26/09 às 10h em São Paulo — semana de 20/09, não a de 27/09.
    const slots = emSaoPaulo(
      slotsDisponiveis(entrada({ parceiro: p, ocupacoes: [naSemana("2026-09-26T13:00:00Z")] })),
    );
    expect(slots.some((s) => s.startsWith("29/09"))).toBe(true);
  });

  it("aparece como teto-semanal no diagnóstico", () => {
    const p = parceiro({ maxPorSemana: 1 });
    const conta = recusas(
      entrada({ parceiro: p, ocupacoes: [naSemana("2026-09-28T13:00:00Z")] }),
    );
    expect(conta["teto-semanal"]).toBe(6);
  });
});

describe("exceções do Parceiro", () => {
  it("férias no dia fecham a grade daquele dia", () => {
    const p = parceiro({
      excecoes: [{ dia: "2026-09-29", tipo: "bloqueio", inicioMin: null, fimMin: null }],
    });
    const slots = emSaoPaulo(slotsDisponiveis(entrada({ parceiro: p })));
    expect(slots.some((s) => s.startsWith("29/09"))).toBe(false);
    expect(slots.some((s) => s.startsWith("06/10"))).toBe(true);
  });

  it("extra abre horário num dia sem regra", () => {
    const p = parceiro({
      excecoes: [{ dia: "2026-09-30", tipo: "extra", inicioMin: 600, fimMin: 660 }],
    });
    const slots = emSaoPaulo(slotsDisponiveis(entrada({ parceiro: p })));
    expect(slots).toContain("30/09, 10:00");
    expect(slots).toContain("30/09, 10:30");
  });

  it("bloqueio parcial tira só os horários daquele pedaço", () => {
    const p = parceiro({
      excecoes: [{ dia: "2026-09-29", tipo: "bloqueio", inicioMin: 600, fimMin: 660 }],
    });
    const slots = emSaoPaulo(slotsDisponiveis(entrada({ parceiro: p })));
    expect(slots).toContain("29/09, 09:00");
    expect(slots).not.toContain("29/09, 10:00");
    expect(slots).not.toContain("29/09, 10:30");
    expect(slots).toContain("29/09, 11:00");
  });
});

describe("fuso do Parceiro", () => {
  /**
   * A regra é "9h no relógio dele". Parceiro em Nova York atendendo às 9h
   * locais é 10h em São Paulo — e o motor devolve o instante, não o número.
   */
  it("a mesma regra em outro fuso dá outro instante", () => {
    const p = parceiro({ fuso: "America/New_York" });
    const slots = slotsDisponiveis(entrada({ parceiro: p }));
    expect(slots[0].inicio.toISOString()).toBe("2026-09-29T13:00:00.000Z");
  });

  it("pula a hora que não existe na virada do horário de verão", () => {
    const p: Parceiro = {
      fuso: "America/New_York",
      bufferMin: 0,
      maxPorSemana: 10,
      // Domingo 08/03/2026, 1h às 4h locais: das 2h às 3h o relógio pulou.
      regras: [{ diaDaSemana: 0, inicioMin: 60, fimMin: 240, valeDe: null, valeAte: null }],
      excecoes: [],
    };
    // Horizonte de 10 dias para a janela pegar só o domingo da virada: 01/03
    // também é domingo e 15/03 seria o terceiro, cada um com a grade cheia.
    const slots = slotsDisponiveis({
      agora: new Date("2026-03-01T12:00:00Z"),
      parceiro: p,
      ocupacoes: [],
      limites: { ...LIMITES, horizonteDias: 10 },
    });
    const horas = slots.map((s) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(s.inicio),
    );
    expect(horas).toEqual(["01:00", "01:30", "03:00", "03:30"]);
  });

  it("recusa fuso inválido em vez de calcular errado", () => {
    expect(() => slotsDisponiveis(entrada({ parceiro: parceiro({ fuso: "Nada/Aqui" }) }))).toThrow(
      /fuso inválido/,
    );
  });
});

describe("proximoSlot", () => {
  it("devolve o primeiro livre", () => {
    expect(emSaoPaulo([proximoSlot(entrada())!])).toEqual(["29/09, 09:00"]);
  });

  it("pula o que está ocupado", () => {
    const ocupada = {
      inicio: new Date("2026-09-29T12:00:00Z"),
      fim: new Date("2026-09-29T12:30:00Z"),
    };
    expect(emSaoPaulo([proximoSlot(entrada({ ocupacoes: [ocupada] }))!])).toEqual(["29/09, 10:00"]);
  });

  it("devolve null quando não há vaga", () => {
    expect(proximoSlot(entrada({ parceiro: parceiro({ regras: [] }) }))).toBeNull();
  });
});

describe("pureza", () => {
  it("a mesma entrada dá sempre a mesma saída", () => {
    const primeira = slotsDisponiveis(entrada());
    const segunda = slotsDisponiveis(entrada());
    expect(primeira.map((s) => s.inicio.toISOString())).toEqual(
      segunda.map((s) => s.inicio.toISOString()),
    );
  });

  it("não modifica o que recebeu", () => {
    const dados = entrada({
      ocupacoes: [
        { inicio: new Date("2026-09-29T12:00:00Z"), fim: new Date("2026-09-29T12:30:00Z") },
      ],
    });
    const copia = structuredClone(dados);
    slotsDisponiveis(dados);
    expect(dados).toEqual(copia);
  });

  /** Motor que olha o relógio não se testa. `agora` é sempre parâmetro. */
  it("depende só do `agora` recebido", () => {
    const antes = slotsDisponiveis(entrada());
    const depois = slotsDisponiveis(entrada({ agora: new Date("2026-09-30T12:00:00Z") }));
    expect(antes).not.toEqual(depois);
    expect(emSaoPaulo(depois)[0]).toBe("06/10, 09:00");
  });
});
