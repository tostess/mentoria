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

/**
 * Centavos → `R$ 449,00`. Dinheiro mora em centavos inteiros (`payments.amount_cents`
 * e `app_config.individual_packages`); só a borda o transforma em texto.
 *
 * O `Intl` separa o símbolo com espaço inseparável; aqui ele vira espaço comum,
 * para o texto da tela ser o mesmo que se copia e se testa.
 */
const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function reais(centavos: number): string {
  return REAIS.format(centavos / 100).replace(/\u00a0/g, " ");
}

/** Parcelamento como a vitrine diz: "à vista" ou "até 3× sem juros". */
export function parcelamento(parcelas: number): string {
  return parcelas <= 1 ? "à vista" : `até ${parcelas}× sem juros`;
}

export { humanizar } from "./humanizar";

// ---------------------------------------------------------------- agenda
//
// Sessões aparecem no fuso de quem olha (`profiles.timezone`), não no fixo da
// tela: o Profissional e o Parceiro podem estar em fusos diferentes, e cada um
// lê a mesma sessão no próprio relógio. O default continua sendo o da tela.

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const SEMANA_LONGA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

function local(data: Date, fuso: string): DateTime {
  return DateTime.fromJSDate(data, { zone: fuso });
}

/** Luxon numera de 1 (segunda) a 7 (domingo); a tela, de 0 (domingo) a 6. */
function indiceDoDia(d: DateTime): number {
  return d.weekday % 7;
}

/** `ter` */
export function diaDaSemanaCurto(data: Date, fuso = FUSO_DA_TELA): string {
  return SEMANA_CURTA[indiceDoDia(local(data, fuso))];
}

/** `terça` */
export function diaDaSemanaLongo(data: Date, fuso = FUSO_DA_TELA): string {
  return SEMANA_LONGA[indiceDoDia(local(data, fuso))];
}

/** `29` */
export function diaDoMes(data: Date, fuso = FUSO_DA_TELA): string {
  return local(data, fuso).toFormat("dd");
}

/** `29/09` */
export function diaEMes(data: Date, fuso = FUSO_DA_TELA): string {
  return local(data, fuso).toFormat("dd/MM");
}

/** `09:00` */
export function hora(data: Date, fuso = FUSO_DA_TELA): string {
  return local(data, fuso).toFormat("HH:mm");
}

/** `ter, 29/09 · 09:00` */
export function diaEHora(data: Date, fuso = FUSO_DA_TELA): string {
  return `${diaDaSemanaCurto(data, fuso)}, ${diaEMes(data, fuso)} · ${hora(data, fuso)}`;
}

/** `ter, 29/09 · 09:00–09:30` */
export function intervalo(inicio: Date, fim: Date, fuso = FUSO_DA_TELA): string {
  return `${diaEHora(inicio, fuso)}–${hora(fim, fuso)}`;
}

/** `2026-09-29` no fuso de quem olha — para agrupar horários por dia. */
export function chaveDoDia(data: Date, fuso = FUSO_DA_TELA): string {
  return local(data, fuso).toFormat("yyyy-MM-dd");
}

/**
 * O rótulo do fuso ao lado da grade de horários. O de Brasília tem nome; os
 * outros saem como identificador IANA, que é feio mas não é ambíguo.
 */
export function rotuloDoFuso(fuso: string): string {
  return fuso === "America/Sao_Paulo" ? "Horário de Brasília" : fuso.replace(/_/g, " ");
}

/** `setembro` — o mês da cota de presente, no fuso da plataforma. */
export function nomeDoMes(data: Date, fuso = FUSO_DA_TELA): string {
  return local(data, fuso).setLocale("pt-BR").toFormat("LLLL");
}

/** "expira em 41 h" / "expira em 25 min" — prazo de resposta do Parceiro. */
export function prazoRestante(limite: Date, agora: Date = new Date()): string {
  const minutos = Math.max(0, Math.floor((limite.getTime() - agora.getTime()) / 60_000));
  if (minutos < 60) return `expira em ${minutos} min`;
  return `expira em ${Math.floor(minutos / 60)} h`;
}
