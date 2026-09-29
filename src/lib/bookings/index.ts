import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import type { AppConfig } from "@/lib/config/app-config";
import { limitesDoMotor } from "@/lib/config/limites";
import { comTraducao } from "@/lib/ledger/erros";
import { acessoDaConexao } from "@/lib/ledger/mensal";
import type { Slot } from "@/lib/scheduling";
import { daily, videoConfigurado } from "@/lib/video";
import { entradasDasReunioes } from "@/lib/video/presenca";
import {
  estadoDoPresente,
  presenteNaSessao,
  type CotaDoMes,
  type PedidoDePresente,
} from "./presente";
import {
  ParceiroIndisponivel,
  horariosLivresNaConexao,
  reservaNaTransacao,
  type Pedido,
  type Reserva,
} from "./operacoes";
import {
  cancelamentoNaTransacao,
  confirmacaoNaTransacao,
  correcaoDePresencaNaTransacao,
  expirarPendentesNaConexao,
  fecharSessoesNaConexao,
  recusaNaTransacao,
  type PedidoDeCancelamento,
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
export {
  CancelamentoRecusado,
  CorrecaoRecusada,
  PedidoJaRespondido,
  SessaoNaoEncontrada,
} from "./transicoes";
export type { PedidoDeCancelamento, Resposta, ResultadoDaRodada } from "./transicoes";
export { PresenteRecusado } from "./presente";
export type { CotaDoMes, PedidoDePresente } from "./presente";

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

/**
 * O Profissional ou o Parceiro cancela a própria sessão (F7). `comTraducao` pela
 * mesma segunda cerca da recusa: a trava já teria dito "já cancelada", então
 * colidir em `refund_` ou `noshow_` é defeito e sobe como `LancamentoRepetido`.
 */
export async function cancelarSessao(
  pedido: PedidoDeCancelamento,
): Promise<{ estornou: boolean; compensou: number }> {
  const sql = getSql();
  return comTraducao(
    () => sql.begin((tx) => cancelamentoNaTransacao(tx, pedido)),
    "Não foi possível cancelar.",
  );
}

/** `expire-pending`, na conexão de verdade: cada sessão commita sozinha. */
export async function expirarPendentes(agora: Date, config: AppConfig): Promise<ResultadoDaRodada> {
  return expirarPendentesNaConexao(acessoDaConexao(getSql()), {
    agora,
    horasParaExpirar: config.limits.pendingExpiresHours,
  });
}

/**
 * `close-sessions`, na conexão de verdade. Com vídeo configurado, a presença
 * vem do Daily; sem ele, vale a regra da P4 — ver `fechamentoNaTransacao`.
 */
export async function fecharSessoes(agora: Date, config: AppConfig): Promise<ResultadoDaRodada> {
  const lerPresenca = videoConfigurado()
    ? async (sala: string) => entradasDasReunioes(await daily().reunioes(sala))
    : null;
  return fecharSessoesNaConexao(
    acessoDaConexao(getSql()),
    {
      agora,
      toleranciaMin: config.limits.sessionGraceMinutes,
      compensacao: config.fichaPolicy.partnerNoShowBonus,
    },
    lerPresenca,
  );
}

/**
 * O Parceiro dá 1 ficha, dentro da sala. `comTraducao` em volta pela segunda
 * cerca: se duas requisições passarem juntas pela conferência (não passam — a
 * sessão é travada antes), a `unique` de `gift_{bookingId}` recusa a segunda.
 */
export async function presentear(pedido: PedidoDePresente): Promise<CotaDoMes> {
  const sql = getSql();
  return comTraducao(
    () => sql.begin((tx) => presenteNaSessao(tx, pedido)),
    "Não foi possível registrar o presente.",
  );
}

/** O Parceiro diz que o Profissional participou; a sala não registrou. Audita. */
export async function corrigirPresenca(resposta: Resposta): Promise<void> {
  await getSql().begin((tx) => correcaoDePresencaNaTransacao(tx, resposta));
}

/**
 * O que o livro-caixa registrou nas sessões do Parceiro, para a agenda dele: em
 * quais ele deu presente, e em quais o Profissional recebeu compensação — pela
 * falta ou pelo cancelamento em cima da hora. Privilegiada, com ele no `where`:
 * a policy de `wallet_ledger` não o deixa ler a carteira de ninguém, e aqui ele
 * só fica sabendo de lançamentos das sessões dele, sem valor nem saldo.
 */
export async function movimentosDoParceiro(
  partnerId: string,
): Promise<{ presentes: Set<string>; compensadas: Set<string> }> {
  const linhas = await getSql()<{ booking_id: string; type: string }[]>`
    select w.booking_id, w.type::text as type from wallet_ledger w
     where w.booking_id is not null
       and ((w.type = 'gift' and w.by_user_id = ${partnerId})
            or (w.type = 'adjust' and exists (
                  select 1 from bookings b where b.id = w.booking_id and b.partner_id = ${partnerId})))`;
  return {
    presentes: new Set(linhas.filter((l) => l.type === "gift").map((l) => l.booking_id)),
    compensadas: new Set(linhas.filter((l) => l.type === "adjust").map((l) => l.booking_id)),
  };
}

/** A cota do mês e se esta sessão já ganhou presente, para a sala do Parceiro. */
export async function presenteNaSala(
  pedido: PedidoDePresente,
): Promise<CotaDoMes & { dadoNestaSessao: boolean }> {
  return estadoDoPresente(getSql(), pedido);
}

/**
 * Grava o nome da sala na sessão, **antes** de qualquer chamada ao Daily.
 *
 * É o que o fechamento usa para saber se há sala a perguntar: sessão sem
 * `room_name` nunca emitiu token. Gravar depois abriria uma janela em que a
 * pessoa entra, a escrita falha, e o fechamento a dá como ausente — com a ficha
 * de quem compareceu indo embora.
 */
export async function marcarSala(bookingId: string): Promise<void> {
  await getSql()`update bookings set room_name = ${bookingId} where id = ${bookingId} and room_name is null`;
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
