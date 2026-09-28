import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import type { AppConfig } from "@/lib/config/app-config";
import { limitesDoMotor } from "@/lib/config/limites";
import { comTraducao } from "@/lib/ledger/erros";
import { acessoDaConexao } from "@/lib/ledger/mensal";
import type { Slot } from "@/lib/scheduling";
import {
  ParceiroIndisponivel,
  horariosLivresNaConexao,
  reservaNaTransacao,
  type Pedido,
  type Reserva,
} from "./operacoes";
import {
  confirmacaoNaTransacao,
  expirarPendentesNaConexao,
  fecharSessoesNaConexao,
  recusaNaTransacao,
  type Resposta,
  type ResultadoDaRodada,
} from "./transicoes";

/**
 * A porta da reserva: abre a transação e traduz a recusa.
 *
 * Mesmo desenho de `ledger/index.ts` — o SQL vive em `operacoes.ts`, que recebe
 * a transação, e aqui fica só o que precisa de conexão. Quando a P4 trouxer a
 * tela de agendar, ela chama o Route Handler; o handler chama esta função. Se um
 * dia houver outra porta (assistente, indicação), ela entra aqui também, e a
 * escrita continua sendo uma só.
 */

export { ParceiroIndisponivel, ProfissionalInvalido } from "./operacoes";
export type { Pedido, Reserva } from "./operacoes";
export { PedidoJaRespondido, SessaoNaoEncontrada } from "./transicoes";
export type { Resposta, ResultadoDaRodada } from "./transicoes";

export type PedidoDeReserva = {
  orgId: string;
  partnerId: string;
  professionalId: string;
  inicio: Date;
  agora: Date;
  config: AppConfig;
  criadoVia?: string;
};

export async function reservar(pedido: PedidoDeReserva): Promise<Reserva> {
  const sql = getSql();

  /**
   * O id nasce aqui, fora da transação, e não no `default gen_random_uuid()`.
   *
   * É o que permite a chave de idempotência `spend_{bookingId}` existir antes da
   * linha do booking, e o `wallet_ledger.booking_id` apontar para ela no mesmo
   * insert — sem isso, o lançamento do gasto ficaria sem dizer de que sessão ele
   * é até um segundo `update`, que o livro-caixa imutável não aceitaria.
   */
  const bookingId = randomUUID();

  const completo: Pedido = {
    bookingId,
    orgId: pedido.orgId,
    partnerId: pedido.partnerId,
    professionalId: pedido.professionalId,
    inicio: pedido.inicio,
    agora: pedido.agora,
    limites: limitesDoMotor(pedido.config),
    precoFichas: pedido.config.fichaPolicy.price30,
    maxPendentes: pedido.config.limits.maxPendingPerProfessional,
    criadoVia: pedido.criadoVia,
  };

  return comTraducao(
    () => sql.begin((tx) => reservaNaTransacao(tx, completo)),
    "Você não tem ficha suficiente para esta sessão.",
  );
}

/** O Parceiro aceita o pedido. `partnerId` vem do JWT de quem chama. */
export async function confirmarPedido(resposta: Resposta): Promise<void> {
  const sql = getSql();
  await sql.begin((tx) => confirmacaoNaTransacao(tx, resposta));
}

/**
 * O Parceiro recusa o pedido e a ficha volta na mesma transação.
 *
 * `comTraducao` em volta porque o estorno pode colidir na chave: é o caso em que
 * o cron expirou o pedido entre a tela abrir e o clique — e aí a trava já teria
 * respondido "expirou", então chegar à colisão é defeito, e ela sobe como
 * `LancamentoRepetido` em vez de erro cru do Postgres.
 */
export async function recusarPedido(resposta: Resposta): Promise<{ saldoCarteira: number }> {
  const sql = getSql();
  return comTraducao(
    () => sql.begin((tx) => recusaNaTransacao(tx, resposta)),
    "Não foi possível devolver a ficha.",
  );
}

/** `expire-pending`, na conexão de verdade: cada sessão commita sozinha. */
export async function expirarPendentes(agora: Date, config: AppConfig): Promise<ResultadoDaRodada> {
  return expirarPendentesNaConexao(acessoDaConexao(getSql()), {
    agora,
    horasParaExpirar: config.limits.pendingExpiresHours,
  });
}

/** `close-sessions`, na conexão de verdade. Regra provisória até a P5 — ver `transicoes.ts`. */
export async function fecharSessoes(agora: Date, config: AppConfig): Promise<ResultadoDaRodada> {
  return fecharSessoesNaConexao(acessoDaConexao(getSql()), {
    agora,
    toleranciaMin: config.limits.sessionGraceMinutes,
  });
}

/**
 * Os horários livres de um Parceiro, para a tela do Profissional.
 *
 * Mesma avaliação que a reserva refaz antes de escrever (`avaliarAgenda`), com
 * os mesmos limites de `app_config`. Levanta `ParceiroIndisponivel` quando o
 * Parceiro não está ativo — a tela decide o que dizer.
 */
export async function horariosLivres(
  partnerId: string,
  agora: Date,
  config: AppConfig,
): Promise<Slot[]> {
  return horariosLivresNaConexao(getSql(), { partnerId, agora, limites: limitesDoMotor(config) });
}

/**
 * O primeiro horário livre de cada Parceiro, para os cartões da busca.
 *
 * **Sequencial, de propósito**: a conexão de runtime é `max: 1`, e consultas
 * Drizzle em paralelo sobre ela entalam o processo inteiro. São quatro leituras
 * por Parceiro — folgado no piloto; perto dos 200 Parceiros em que a busca no
 * cliente deixa de valer, isto vira uma leitura em lote.
 */
export async function primeiroHorarioDeCada(
  partnerIds: string[],
  agora: Date,
  config: AppConfig,
): Promise<Map<string, Date | null>> {
  const sql = getSql();
  const limites = limitesDoMotor(config);
  const resultado = new Map<string, Date | null>();

  for (const partnerId of partnerIds) {
    try {
      const livres = await horariosLivresNaConexao(sql, { partnerId, agora, limites });
      resultado.set(partnerId, livres[0]?.inicio ?? null);
    } catch (erro) {
      // Pausado entre a leitura da lista e esta: aparece sem horário, não derruba a busca.
      if (erro instanceof ParceiroIndisponivel) resultado.set(partnerId, null);
      else throw erro;
    }
  }
  return resultado;
}
