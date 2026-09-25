/**
 * Conversões entre o que o Parceiro digita e o que o banco guarda.
 *
 * O banco guarda minutos desde a meia-noite (invariante 2) e o `<input
 * type="time">` fala `HH:MM`. A tradução vive aqui, pura e testada, porque é o
 * tipo de conta que parece óbvia e erra em 24:00, em `9:5` e em campo vazio.
 */

import type { DiaDaSemana } from "@/lib/scheduling";

export class HorarioInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "HorarioInvalido";
  }
}

const HORA = /^(\d{1,2}):(\d{2})$/;

/** `"09:30"` → 570. Recusa o que não for hora do dia. */
export function paraMinutos(texto: string): number {
  const casa = HORA.exec(texto.trim());
  if (casa === null) throw new HorarioInvalido(`Horário inválido: ${texto || "vazio"}.`);
  const hora = Number(casa[1]);
  const minuto = Number(casa[2]);
  if (hora > 23 || minuto > 59) throw new HorarioInvalido(`Horário inválido: ${texto}.`);
  return hora * 60 + minuto;
}

/** 570 → `"09:30"`. 1440 vira `"24:00"`, que é o fim do dia e não hora nenhuma. */
export function paraTexto(minutos: number): string {
  const hora = Math.floor(minutos / 60);
  const minuto = minutos % 60;
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

/** Nomes dos dias na ordem do banco: índice 0 é domingo. */
export const DIAS: readonly { valor: DiaDaSemana; curto: string; longo: string }[] = [
  { valor: 0, curto: "Dom", longo: "domingo" },
  { valor: 1, curto: "Seg", longo: "segunda-feira" },
  { valor: 2, curto: "Ter", longo: "terça-feira" },
  { valor: 3, curto: "Qua", longo: "quarta-feira" },
  { valor: 4, curto: "Qui", longo: "quinta-feira" },
  { valor: 5, curto: "Sex", longo: "sexta-feira" },
  { valor: 6, curto: "Sáb", longo: "sábado" },
];

export function ehDiaDaSemana(valor: unknown): valor is DiaDaSemana {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 6;
}

/**
 * Resumo legível da rotina: "Ter, Qui e Sex, das 09:00 às 12:00".
 *
 * Existe para a tela poder dizer numa linha o que o Parceiro configurou, em vez
 * de obrigá-lo a reler sete caixas de seleção para conferir.
 */
export function resumoDaRotina(
  dias: readonly DiaDaSemana[],
  inicioMin: number,
  fimMin: number,
): string {
  if (dias.length === 0) return "Nenhum dia selecionado.";

  const nomes = [...new Set(dias)]
    .sort((a, b) => a - b)
    .map((dia) => DIAS[dia].curto);

  const lista =
    nomes.length === 1
      ? nomes[0]
      : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

  return `${lista}, das ${paraTexto(inicioMin)} às ${paraTexto(fimMin)}`;
}

/**
 * Quantas sessões cabem por semana na rotina, ignorando descanso e reservas.
 *
 * É o número que a tela mostra ao lado do teto semanal, para o Parceiro ver que
 * abrir 3h em cinco dias não significa atender 30 vezes — o `max_per_week`
 * continua valendo, e é ele que decide.
 */
export function cabemPorSemana(
  quantidadeDeDias: number,
  inicioMin: number,
  fimMin: number,
  duracaoMin: number,
): number {
  if (duracaoMin <= 0 || fimMin <= inicioMin) return 0;
  return Math.floor((fimMin - inicioMin) / duracaoMin) * quantidadeDeDias;
}
