import { aoDia, normalizar, subtrair, unir, MINUTOS_NO_DIA } from "./faixas";
import type { DiaDaSemana, Excecao, Faixa, Parceiro, RegraSemanal } from "./tipos";

/**
 * De "toda terça das 9h às 12h" para "no dia 29/09, das 9h às 12h".
 *
 * Ainda em minutos locais: este módulo não sabe o que é fuso nem instante. É a
 * ponte entre a intenção semanal do Parceiro e um dia concreto do calendário,
 * e resolve três coisas nesta ordem — regra, extra, bloqueio.
 *
 * A ordem importa. Bloqueio depois de extra significa que férias vencem um
 * horário extra marcado para o mesmo dia; o contrário deixaria o Parceiro
 * atender no meio das férias por causa de um extra esquecido.
 */

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Dia da semana de uma data local, 0 = domingo.
 *
 * Vai por `Date.UTC` de propósito: `new Date("2026-09-29")` é interpretado como
 * meia-noite **UTC**, e no fuso de São Paulo isso é dia 28 — a data trocaria de
 * dia da semana dependendo de onde o servidor está. Aqui não há fuso nenhum
 * envolvido, só aritmética de calendário.
 */
export function diaDaSemanaDe(iso: string): DiaDaSemana {
  const casa = DATA_ISO.exec(iso);
  if (casa === null) throw new Error(`data local inválida: ${iso}`);
  const [, ano, mes, dia] = casa;
  return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia))).getUTCDay() as DiaDaSemana;
}

/** A data existe no calendário? Recusa 31/02 antes de virar horário. */
export function ehDataValida(iso: string): boolean {
  const casa = DATA_ISO.exec(iso);
  if (casa === null) return false;
  const [, a, m, d] = casa.map(Number) as unknown as [string, number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

/** A regra vale neste dia? Comparação de string basta: ISO ordena sozinho. */
function valeNoDia(regra: RegraSemanal, iso: string): boolean {
  if (regra.valeDe !== null && iso < regra.valeDe) return false;
  if (regra.valeAte !== null && iso > regra.valeAte) return false;
  return true;
}

function comoFaixa(excecao: Excecao): Faixa | null {
  if (excecao.inicioMin === null || excecao.fimMin === null) return null;
  return aoDia({ inicio: excecao.inicioMin, fim: excecao.fimMin });
}

/**
 * As faixas locais em que o Parceiro atende num dia — regra semanal mais
 * extras, menos bloqueios.
 *
 * Bloqueio sem faixa é o dia inteiro. Extra sem faixa é ignorado: "abrir o dia
 * todo" por causa de um campo vazio seria um estrago silencioso, e quem quer
 * abrir o dia todo digita 0 a 1440.
 */
export function faixasDoDia(parceiro: Parceiro, iso: string): Faixa[] {
  if (!ehDataValida(iso)) throw new Error(`data local inválida: ${iso}`);
  const diaDaSemana = diaDaSemanaDe(iso);

  const daRegra = parceiro.regras
    .filter((regra) => regra.diaDaSemana === diaDaSemana && valeNoDia(regra, iso))
    .map((regra) => aoDia({ inicio: regra.inicioMin, fim: regra.fimMin }))
    .filter((faixa): faixa is Faixa => faixa !== null);

  const doDia = parceiro.excecoes.filter((excecao) => excecao.dia === iso);

  const extras = doDia
    .filter((excecao) => excecao.tipo === "extra")
    .map(comoFaixa)
    .filter((faixa): faixa is Faixa => faixa !== null);

  const bloqueios = doDia
    .filter((excecao) => excecao.tipo === "bloqueio")
    .map((excecao) => comoFaixa(excecao) ?? { inicio: 0, fim: MINUTOS_NO_DIA });

  return subtrair(unir(normalizar(daRegra), extras), bloqueios);
}

/** Datas locais de `de` até `ate`, inclusive. Aritmética de calendário, sem fuso. */
export function diasEntre(de: string, ate: string): string[] {
  if (!ehDataValida(de) || !ehDataValida(ate)) {
    throw new Error(`intervalo de datas inválido: ${de} a ${ate}`);
  }
  const dias: string[] = [];
  const fim = Date.parse(`${ate}T00:00:00Z`);
  let atual = Date.parse(`${de}T00:00:00Z`);

  // Teto de segurança: horizonte é de 14 dias, e laço infinito em motor de
  // agenda não dá erro — dá servidor parado.
  for (let i = 0; atual <= fim && i < 400; i += 1) {
    dias.push(new Date(atual).toISOString().slice(0, 10));
    atual += 86_400_000;
  }
  return dias;
}
