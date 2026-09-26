import type { Limites } from "@/lib/scheduling";
import type { AppConfig } from "./app-config";

/**
 * `app_config.limits` traduzido para o que o motor de agenda espera.
 *
 * Os dois falam do mesmo assunto com nomes diferentes de propósito: o banco usa
 * o vocabulário do produto (`booking_horizon_days`) e o motor usa o dele
 * (`horizonteDias`), porque `src/lib/scheduling/` é puro e não conhece
 * `app_config` — é o que permite um teste inventar limites sem tocar no banco.
 *
 * Esta função existe para a tradução acontecer **num lugar só**. Ela estava
 * escrita à mão dentro da tela de disponibilidade; quando a reserva passou a
 * precisar da mesma conta, duas cópias viraram o caminho curto para as duas
 * discordarem — e o efeito seria a tela oferecer um horário que a reserva
 * recusa, que é o pior jeito de descobrir.
 *
 * Módulo puro.
 */

/**
 * Duração da sessão, em minutos.
 *
 * Constante e não configuração: "Sessão de 30 minutos apenas no lançamento" é
 * decisão de produto, e `bookings.duration_min` tem o mesmo 30 como default.
 * Quando houver mais de uma duração, ela entra em `app_config` e esta constante
 * morre — não antes, para não haver um número configurável que ninguém
 * configura.
 */
export const DURACAO_DA_SESSAO_MIN = 30;

/**
 * De quanto em quanto tempo um horário pode começar dentro da mesma faixa.
 *
 * Igual à duração: faixas viram sessões encostadas, e o descanso entre elas é
 * imposto pelo `buffer_min` do Parceiro contra o que já está marcado, não pelo
 * espaçamento da grade.
 */
export const PASSO_DA_GRADE_MIN = DURACAO_DA_SESSAO_MIN;

export function limitesDoMotor(config: AppConfig): Limites {
  return {
    horizonteDias: config.limits.bookingHorizonDays,
    avisoMinimoHoras: config.limits.minNoticeHours,
    duracaoMin: DURACAO_DA_SESSAO_MIN,
    passoMin: PASSO_DA_GRADE_MIN,
  };
}
