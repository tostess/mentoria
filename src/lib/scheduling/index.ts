/**
 * Motor de agenda. Invariante 1: TypeScript puro, sem banco e sem rede,
 * validado por teste e **travado** — mudança aqui vem com teste.
 *
 * Quem consome: a tela de disponibilidade do Parceiro (para mostrar o que ele
 * acabou de configurar) e a busca e o agendamento do Profissional (invariante
 * 14 — todo horário exibido vem daqui).
 */

export type {
  DiaDaSemana,
  Excecao,
  Faixa,
  Limites,
  MotivoDaRecusa,
  Ocupacao,
  Parceiro,
  RegraSemanal,
  Slot,
} from "./tipos";

export { MINUTOS_NO_DIA, normalizar, subtrair, total, unir } from "./faixas";
export { diaDaSemanaDe, diasEntre, ehDataValida, faixasDoDia } from "./dias";
export {
  avaliarSlots,
  chaveDaSemana,
  instanteLocal,
  proximoSlot,
  slotsDisponiveis,
  type Avaliacao,
  type Entrada,
} from "./slots";
