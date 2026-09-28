import type postgres from "postgres";
import { paraInstante } from "@/lib/db/instantes";
import type { Ator } from "@/lib/ledger/operacoes";
import { estornoNaTransacao } from "@/lib/ledger/operacoes";
import type { Acesso } from "@/lib/ledger/mensal";

/**
 * As arestas da máquina de estados que a P4 percorre.
 *
 * ```
 * pending ──confirmar──▶ confirmed ──fim + tolerância──▶ done
 *    │  └──recusar──▶ cancelled (estorno imediato)
 *    └──48h sem resposta, ou o horário passou──▶ expired (estorno)
 * ```
 *
 * Mesmo desenho de `operacoes.ts`: cada transição recebe a transação, sem
 * `server-only`, para o teste chamar a função que a aplicação chama.
 *
 * **Toda transição trava a sessão antes de ler o status.** É o que resolve a
 * corrida de verdade — o Parceiro recusando no minuto em que o cron expira: a
 * segunda transação espera a primeira, relê o status e desiste. A chave única
 * `refund_{bookingId}` é a segunda cerca, para o dia em que alguém escrever uma
 * transição nova e esquecer do `for update`.
 */

export class SessaoNaoEncontrada extends Error {
  constructor() {
    super("Não encontramos esse pedido na sua agenda.");
    this.name = "SessaoNaoEncontrada";
  }
}

/** O pedido já não está esperando resposta: foi respondido, expirou ou o horário passou. */
export class PedidoJaRespondido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "PedidoJaRespondido";
  }
}

/** O que o extrato do Profissional mostra. Sem termo de domínio: vai para o banco. */
export const MOTIVO_RECUSA = "Pedido recusado";
export const MOTIVO_EXPIRACAO = "Pedido expirou sem resposta";

type LinhaTravada = {
  status: string;
  start_at: string;
  created_at: string;
};

/**
 * Trava a sessão do Parceiro e devolve o que as transições precisam.
 *
 * O `partner_id` entra no `where`, e não numa conferência depois: sessão de outro
 * Parceiro e sessão inexistente dão a mesma resposta, e quem tenta adivinhar id
 * não descobre qual dos dois acertou.
 */
async function travarDoParceiro(
  tx: postgres.TransactionSql,
  bookingId: string,
  partnerId: string,
): Promise<LinhaTravada> {
  const [linha] = await tx<LinhaTravada[]>`
    select status::text, start_at, created_at from bookings
     where id = ${bookingId} and partner_id = ${partnerId}
       for update`;
  if (!linha) throw new SessaoNaoEncontrada();
  return linha;
}

/** O pedido ainda pode ser respondido? A mesma regra que o cron usa para expirar. */
function exigePendente(linha: LinhaTravada, agora: Date): void {
  if (linha.status !== "pending") {
    throw new PedidoJaRespondido(
      linha.status === "expired"
        ? "Esse pedido expirou e a ficha já voltou para quem pediu."
        : "Esse pedido já foi respondido.",
    );
  }
  if (new Date(linha.start_at).getTime() <= agora.getTime()) {
    throw new PedidoJaRespondido("O horário desse pedido já passou.");
  }
}

export type Resposta = {
  bookingId: string;
  /** Vem do JWT, nunca do corpo da requisição (invariante 19). */
  partnerId: string;
  agora: Date;
};

/**
 * `pending → confirmed`.
 *
 * Não reconfere a agenda. Pedido pendente já ocupa o horário — a constraint de
 * exclusão cobre `pending` e `confirmed` (invariante 7) e o teto semanal do motor
 * conta os dois —, então confirmar não muda o que está ocupado, só o nome.
 */
export async function confirmacaoNaTransacao(
  tx: postgres.TransactionSql,
  resposta: Resposta,
): Promise<void> {
  const linha = await travarDoParceiro(tx, resposta.bookingId, resposta.partnerId);
  exigePendente(linha, resposta.agora);

  await tx`
    update bookings
       set status = 'confirmed',
           confirmed_at = ${paraInstante(resposta.agora)}::text::timestamptz
     where id = ${resposta.bookingId}`;
}

/**
 * `pending → cancelled`, com a ficha de volta na mesma transação.
 *
 * Decisão da P4: recusar estorna na hora. Esperar o cron expirar o pedido faria
 * o Profissional aguardar dois dias por um "não" já dado, com a ficha e uma das
 * vagas de pendente presas nesse meio-tempo.
 */
export async function recusaNaTransacao(
  tx: postgres.TransactionSql,
  resposta: Resposta,
): Promise<{ saldoCarteira: number }> {
  const linha = await travarDoParceiro(tx, resposta.bookingId, resposta.partnerId);
  exigePendente(linha, resposta.agora);

  await tx`
    update bookings
       set status = 'cancelled',
           cancelled_at = ${paraInstante(resposta.agora)}::text::timestamptz,
           cancelled_by = ${resposta.partnerId}
     where id = ${resposta.bookingId}`;

  const ator: Ator = { id: resposta.partnerId, role: "partner" };
  const { saldoCarteira } = await estornoNaTransacao(tx, {
    bookingId: resposta.bookingId,
    ator,
    motivo: MOTIVO_RECUSA,
  });
  return { saldoCarteira };
}

// ---------------------------------------------------------------- trabalho agendado

export type RegraDeExpiracao = { agora: Date; horasParaExpirar: number };

/**
 * Pedido que ninguém respondeu expira por dois caminhos, e o segundo não é óbvio.
 *
 * O óbvio é `pending_expires_hours` desde o pedido. O outro é o horário chegar:
 * com aviso mínimo de 12 h e prazo de 48 h, um pedido feito na véspera chega à
 * hora marcada ainda dentro do prazo. Sem esta segunda condição ele ficaria
 * pendente depois de a sessão ter passado, com a ficha presa até o prazo vencer.
 */
function limiteDoPedido(regra: RegraDeExpiracao): string | null {
  return paraInstante(new Date(regra.agora.getTime() - regra.horasParaExpirar * 3_600_000));
}

/**
 * `pending → expired`, com estorno. Devolve `false` quando outro caminho chegou
 * antes — o Parceiro respondeu entre a listagem e a trava —, e isso não é erro.
 */
export async function expiracaoNaTransacao(
  tx: postgres.TransactionSql,
  bookingId: string,
  regra: RegraDeExpiracao,
): Promise<boolean> {
  const [linha] = await tx<{ id: string }[]>`
    select id from bookings
     where id = ${bookingId}
       and status = 'pending'
       and (created_at <= ${limiteDoPedido(regra)}::text::timestamptz
            or start_at <= ${paraInstante(regra.agora)}::text::timestamptz)
       for update`;
  if (!linha) return false;

  await tx`update bookings set status = 'expired' where id = ${bookingId}`;
  await estornoNaTransacao(tx, { bookingId, ator: null, motivo: MOTIVO_EXPIRACAO });
  return true;
}

export type RegraDeFechamento = { agora: Date; toleranciaMin: number };

/**
 * `confirmed → done`, quando passa `end_at` + tolerância.
 *
 * **Regra provisória da P4**: sem sala não há presença, e sem presença não dá
 * para distinguir `done` de `no_show_*`. A P5 troca esta função pela que lê a
 * presença da sala; até lá nenhuma sessão termina em falta.
 *
 * `session_count` do Parceiro sobe aqui, na mesma transação — é contagem de
 * sessão realizada, e a P5 herda o lugar.
 */
export async function fechamentoNaTransacao(
  tx: postgres.TransactionSql,
  bookingId: string,
  regra: RegraDeFechamento,
): Promise<boolean> {
  const corte = paraInstante(new Date(regra.agora.getTime() - regra.toleranciaMin * 60_000));
  const [linha] = await tx<{ partner_id: string }[]>`
    select partner_id from bookings
     where id = ${bookingId}
       and status = 'confirmed'
       and end_at <= ${corte}::text::timestamptz
       for update`;
  if (!linha) return false;

  await tx`update bookings set status = 'done' where id = ${bookingId}`;
  await tx`update partners set session_count = session_count + 1 where id = ${linha.partner_id}`;
  return true;
}

export type ResultadoDaRodada = {
  /** Sessões que mudaram de status nesta execução. */
  feitas: number;
  /** Listadas, mas outro caminho chegou antes da trava. */
  jaResolvidas: number;
  /** Falhas de verdade, com a mensagem. Não interrompem a rodada. */
  erros: string[];
};

/**
 * Uma transação **por sessão**, pelo mesmo motivo da recarga mensal: um dado
 * corrompido numa sessão não pode deixar as outras presas. E pelo mesmo motivo a
 * rodada interrompida no meio é segura — a próxima relista e retoma.
 */
async function rodada(
  acesso: Acesso,
  ids: string[],
  transicao: (tx: postgres.TransactionSql, id: string) => Promise<boolean>,
  rotulo: string,
): Promise<ResultadoDaRodada> {
  const resultado: ResultadoDaRodada = { feitas: 0, jaResolvidas: 0, erros: [] };
  for (const id of ids) {
    try {
      const mudou = await acesso.emTransacao((tx) => transicao(tx, id));
      if (mudou) resultado.feitas += 1;
      else resultado.jaResolvidas += 1;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      resultado.erros.push(`${id}: ${mensagem}`);
      console.error(`[${rotulo}]`, id, mensagem);
    }
  }
  return resultado;
}

/** `expire-pending`: todo pedido vencido, de todos os Parceiros. */
export async function expirarPendentesNaConexao(
  acesso: Acesso,
  regra: RegraDeExpiracao,
): Promise<ResultadoDaRodada> {
  const linhas = await acesso.sql<{ id: string }[]>`
    select id from bookings
     where status = 'pending'
       and (created_at <= ${limiteDoPedido(regra)}::text::timestamptz
            or start_at <= ${paraInstante(regra.agora)}::text::timestamptz)
     order by created_at`;

  return rodada(
    acesso,
    linhas.map((l) => l.id),
    (tx, id) => expiracaoNaTransacao(tx, id, regra),
    "expire-pending",
  );
}

/** `close-sessions`: toda sessão confirmada cuja tolerância já passou. */
export async function fecharSessoesNaConexao(
  acesso: Acesso,
  regra: RegraDeFechamento,
): Promise<ResultadoDaRodada> {
  const corte = paraInstante(new Date(regra.agora.getTime() - regra.toleranciaMin * 60_000));
  const linhas = await acesso.sql<{ id: string }[]>`
    select id from bookings
     where status = 'confirmed'
       and end_at <= ${corte}::text::timestamptz
     order by end_at`;

  return rodada(
    acesso,
    linhas.map((l) => l.id),
    (tx, id) => fechamentoNaTransacao(tx, id, regra),
    "close-sessions",
  );
}
