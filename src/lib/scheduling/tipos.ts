/**
 * O vocabulário do motor de agenda.
 *
 * Invariante 1: `src/lib/scheduling/` é TypeScript puro — sem banco, sem rede.
 * Quem lê `partner_rules` e `bookings` é a camada de dados; aqui entram objetos
 * simples e sai uma lista de horários. É isso que permite travar o motor por
 * teste: toda a regra de agenda é uma função, e função se prova.
 *
 * Invariante 2: a regra semanal do Parceiro é **minutos desde a meia-noite no
 * fuso dele**, mais o fuso IANA. Não é `timestamptz`, porque "toda terça das 9h
 * às 12h" não é um instante — é uma intenção que vira instantes diferentes em
 * semanas diferentes, e diferentes de novo se o fuso tiver horário de verão.
 *
 * Invariante 14: todo horário exibido vem daqui. Nenhuma tela calcula um
 * horário por conta própria.
 */

/**
 * Faixa de minutos desde a meia-noite local. `fim` é exclusivo — 9h às 12h é
 * `{ inicio: 540, fim: 720 }`, e o dia inteiro é `{ inicio: 0, fim: 1440 }`.
 */
export type Faixa = { inicio: number; fim: number };

/** Dia da semana como o banco guarda: 0 é domingo. */
export type DiaDaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Regra semanal de disponibilidade — uma linha de `partner_rules`.
 *
 * `valeDe` e `valeAte` são datas locais `YYYY-MM-DD` inclusivas, ou null para
 * "sempre". Servem para o Parceiro mudar a rotina sem apagar o histórico: a
 * regra antiga ganha `valeAte` e a nova começa no dia seguinte.
 */
export type RegraSemanal = {
  diaDaSemana: DiaDaSemana;
  inicioMin: number;
  fimMin: number;
  valeDe: string | null;
  valeAte: string | null;
};

/**
 * Exceção de um dia — uma linha de `partner_exceptions`.
 *
 * `bloqueio` sem faixa é o dia inteiro fora: é como se marca férias e feriado.
 * `extra` sem faixa não faz sentido e é ignorado — abrir "o dia inteiro" por
 * acidente é pior que não abrir nada.
 */
export type Excecao = {
  /** Data local `YYYY-MM-DD`. */
  dia: string;
  tipo: "bloqueio" | "extra";
  inicioMin: number | null;
  fimMin: number | null;
};

/** Sessão que já existe na agenda do Parceiro, como instante. */
export type Ocupacao = { inicio: Date; fim: Date };

/**
 * O que o Parceiro configurou sobre si.
 *
 * `fuso` é IANA (`America/Sao_Paulo`). `bufferMin` é descanso entre sessões e
 * `maxPorSemana` é o teto de carga — os dois vêm de `partners`.
 */
export type Parceiro = {
  fuso: string;
  bufferMin: number;
  maxPorSemana: number;
  regras: readonly RegraSemanal[];
  excecoes: readonly Excecao[];
};

/**
 * Os limites da plataforma, de `app_config.limits`.
 *
 * Chegam por parâmetro e não são lidos aqui de propósito: o motor não conhece
 * `app_config`, então a mesma função serve para simular outro cenário num teste
 * e para uma empresa com limites próprios depois.
 */
export type Limites = {
  /** Quantos dias para frente a agenda se abre. */
  horizonteDias: number;
  /** Antecedência mínima entre agora e o começo da sessão. */
  avisoMinimoHoras: number;
  /** Duração da sessão. 30 no lançamento. */
  duracaoMin: number;
  /**
   * De quanto em quanto tempo um horário pode começar dentro da mesma faixa.
   * Igual à duração por default: faixas viram sessões encostadas, e o descanso
   * entre elas é imposto pelo `bufferMin` contra o que já está marcado.
   */
  passoMin: number;
};

export type Slot = { inicio: Date; fim: Date };

/** Por que um horário não entrou na lista. Existe para o teste e para o log. */
export type MotivoDaRecusa =
  | "fora-do-aviso-minimo"
  | "fora-do-horizonte"
  | "ocupado"
  | "descanso"
  | "teto-semanal"
  | "hora-inexistente";
