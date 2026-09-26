import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import type { AppConfig } from "@/lib/config/app-config";
import { limitesDoMotor } from "@/lib/config/limites";
import { comTraducao } from "@/lib/ledger/erros";
import { reservaNaTransacao, type Pedido, type Reserva } from "./operacoes";

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
