import { DateTime } from "luxon";

/**
 * Datas, números de documento e períodos como a tela mostra.
 *
 * Invariante 2: o banco guarda `timestamptz` e a conversão acontece só na
 * borda de UI — estas funções **são** a borda, e são as únicas que decidem
 * fuso. O fuso é fixo no piloto; quando a operadora tiver gente em outro
 * fuso, ele passa a vir de `profiles.timezone` e só este arquivo muda.
 *
 * Puro: sem banco, sem `server-only`. Servidor e cliente formatam igual.
 */

export const FUSO_DA_TELA = "America/Sao_Paulo";

const DIA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: FUSO_DA_TELA });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: FUSO_DA_TELA,
});

/** `25/09/2026` */
export function dia(data: Date): string {
  return DIA.format(data);
}

/** `25/09/2026, 14:30` */
export function dataHora(data: Date): string {
  return DATA_HORA.format(data);
}

/**
 * Tempo relativo para listas de atividade: o que aconteceu há pouco é lido
 * como "há 12 min", e o que é de outro dia volta a ter data.
 *
 * "Hoje" e "ontem" são do calendário de São Paulo, não de 24 horas corridas:
 * uma ação às 23h50 de ontem é "ontem" às 0h10 de hoje, embora faça vinte
 * minutos — é assim que a pessoa conta.
 *
 * Instante no futuro (relógio do servidor adiantado) vira "agora há pouco" em
 * vez de "há -2 min".
 */
export function quandoRelativo(data: Date, agora: Date = new Date()): string {
  const segundos = Math.floor((agora.getTime() - data.getTime()) / 1000);
  if (segundos < 60) return "agora há pouco";
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;

  const alvo = DateTime.fromJSDate(data, { zone: FUSO_DA_TELA });
  const referencia = DateTime.fromJSDate(agora, { zone: FUSO_DA_TELA });
  const hora = alvo.toFormat("HH:mm");

  if (alvo.hasSame(referencia, "day")) return `hoje, ${hora}`;
  if (alvo.hasSame(referencia.minus({ days: 1 }), "day")) return `ontem, ${hora}`;
  if (alvo.hasSame(referencia, "year")) return `${alvo.toFormat("dd/MM")}, ${hora}`;
  return `${alvo.toFormat("dd/MM/yyyy")}, ${hora}`;
}

/**
 * Datas de contrato são `date`, não `timestamptz`: chegam como `YYYY-MM-DD` e
 * são formatadas por corte de string. Passá-las por `new Date()` as colocaria
 * em UTC e o dia 1º viraria o dia 31 do mês anterior em São Paulo.
 */
export function diaDoContrato(iso: string): string {
  const [ano, mes, d] = iso.split("-");
  return `${d}/${mes}/${ano}`;
}

export function periodoDoContrato(inicio: string | null, fim: string | null): string {
  if (inicio === null && fim === null) return "Contrato sem período registrado.";
  if (inicio !== null && fim !== null) {
    return `Contrato de ${diaDoContrato(inicio)} a ${diaDoContrato(fim)}.`;
  }
  if (inicio !== null) return `Contrato a partir de ${diaDoContrato(inicio)}.`;
  return `Contrato até ${diaDoContrato(fim as string)}.`;
}

/** 14 dígitos → `12.345.678/0001-90`. Qualquer outra coisa sai como veio. */
export function cnpj(digitos: string | null): string {
  if (digitos === null) return "sem CNPJ";
  if (digitos.length !== 14) return digitos;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

export { humanizar } from "./humanizar";
