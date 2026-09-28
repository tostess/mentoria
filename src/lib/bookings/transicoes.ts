import type postgres from "postgres";
import { paraJsonb } from "@/lib/db/jsonb";
import { paraInstante } from "@/lib/db/instantes";
import type { Ator } from "@/lib/ledger/operacoes";
import { compensacaoNaTransacao, estornoNaTransacao } from "@/lib/ledger/operacoes";
import type { Acesso } from "@/lib/ledger/mensal";
import { compareceu, desfecho, type EntradaNaSala } from "@/lib/video/presenca";

/**
 * As arestas da máquina de estados.
 *
 * ```
 * pending ──confirmar──▶ confirmed ──fim + tolerância──▶ done
 *    │  └──recusar──▶ cancelled (estorno)    ├──ninguém ou só o Parceiro──▶ no_show_professional
 *    └──48h, ou o horário passou──▶ expired  └──só o Profissional──▶ no_show_partner (estorno + compensação)
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
export const MOTIVO_SEM_ATENDIMENTO = "A sessão não aconteceu";
export const MOTIVO_COMPENSACAO = "Compensação pela sessão que não aconteceu";

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

export type RegraDeFechamento = {
  agora: Date;
  toleranciaMin: number;
  /** `partner_no_show_bonus`: fichas a mais quando o Parceiro faltou. */
  compensacao: number;
};

/**
 * O que a sala disse sobre a sessão. `null` é "não há sala para perguntar" — o
 * ambiente sem chave do Daily, como a produção enquanto não tem domínio próprio.
 */
export type PresencaDaSala = EntradaNaSala[] | null;

/**
 * `confirmed → done | no_show_*`, quando passa `end_at` + tolerância.
 *
 * A presença chega **pronta**, lida do Daily antes da transação: nunca se segura
 * transação aberta em volta de chamada HTTP, e a conexão de runtime é `max: 1`.
 *
 * Sem sala (`presenca === null`) vale a regra da P4 — confirmada que passou vira
 * `done` —, porque sem sala ninguém teria como entrar e marcar falta seria
 * inventar. Com sala, invariante 18: grava cada entrada em `session_events` e
 * decide pelo que a sala viu. `no_show_partner` estorna e compensa na mesma
 * transação; `session_count` do Parceiro só sobe em `done`.
 */
export async function fechamentoNaTransacao(
  tx: postgres.TransactionSql,
  bookingId: string,
  regra: RegraDeFechamento,
  presenca: PresencaDaSala,
): Promise<boolean> {
  const corte = paraInstante(new Date(regra.agora.getTime() - regra.toleranciaMin * 60_000));
  const [linha] = await tx<
    { partner_id: string; professional_id: string; start_at: string; end_at: string }[]
  >`
    select partner_id, professional_id, start_at, end_at from bookings
     where id = ${bookingId}
       and status = 'confirmed'
       and end_at <= ${corte}::text::timestamptz
       for update`;
  if (!linha) return false;

  if (presenca === null) {
    await tx`update bookings set status = 'done' where id = ${bookingId}`;
    await tx`update partners set session_count = session_count + 1 where id = ${linha.partner_id}`;
    return true;
  }

  const inicio = new Date(linha.start_at);
  const fim = new Date(linha.end_at);
  const parceiro = compareceu(presenca, linha.partner_id, inicio, fim);
  const profissional = compareceu(presenca, linha.professional_id, inicio, fim);
  const status = desfecho({ parceiro, profissional });

  await tx`
    update bookings
       set status = ${status}::booking_status,
           attended_partner = ${parceiro},
           attended_professional = ${profissional}
     where id = ${bookingId}`;

  for (const entrada of presenca) {
    const bruto = {
      reuniao: entrada.reuniaoId,
      participante: entrada.participantId,
      entrou: entrada.entrou.toISOString(),
      saiu: entrada.saiu.toISOString(),
    };
    await tx`
      insert into session_events (booking_id, user_id, kind, at, raw) values
        (${bookingId}, ${entrada.userId}, 'participant.joined',
         ${paraInstante(entrada.entrou)}::text::timestamptz, ${paraJsonb(bruto)}::text::jsonb),
        (${bookingId}, ${entrada.userId}, 'participant.left',
         ${paraInstante(entrada.saiu)}::text::timestamptz, ${paraJsonb(bruto)}::text::jsonb)`;
  }

  if (status === "done") {
    await tx`update partners set session_count = session_count + 1 where id = ${linha.partner_id}`;
  }

  if (status === "no_show_partner") {
    await estornoNaTransacao(tx, { bookingId, ator: null, motivo: MOTIVO_SEM_ATENDIMENTO });
    await compensacaoNaTransacao(tx, {
      bookingId,
      quantidade: regra.compensacao,
      motivo: MOTIVO_COMPENSACAO,
    });
  }

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

/**
 * Quem sabe perguntar à sala. `null` quando não há vídeo configurado.
 * Recebe o nome da sala (`bookings.room_name`).
 */
export type LeitorDePresenca = ((sala: string) => Promise<EntradaNaSala[]>) | null;

/**
 * `close-sessions`: toda sessão confirmada cuja tolerância já passou.
 *
 * A presença de cada sessão é lida **antes** da transação dela. Sessão sem
 * `room_name` nunca emitiu token — a entrada grava o nome antes de chamar o Daily
 * —, então ninguém entrou, e não há por que perguntar. Daily fora do ar não fecha
 * a sessão: ela vira erro desta rodada e a próxima tenta de novo. Fechar sem saber
 * decidiria dinheiro no escuro.
 */
export async function fecharSessoesNaConexao(
  acesso: Acesso,
  regra: RegraDeFechamento,
  lerPresenca: LeitorDePresenca,
): Promise<ResultadoDaRodada> {
  const corte = paraInstante(new Date(regra.agora.getTime() - regra.toleranciaMin * 60_000));
  const linhas = await acesso.sql<{ id: string; room_name: string | null }[]>`
    select id, room_name from bookings
     where status = 'confirmed'
       and end_at <= ${corte}::text::timestamptz
     order by end_at`;

  const resultado: ResultadoDaRodada = { feitas: 0, jaResolvidas: 0, erros: [] };
  for (const { id, room_name: sala } of linhas) {
    try {
      const presenca = lerPresenca === null ? null : sala === null ? [] : await lerPresenca(sala);
      const mudou = await acesso.emTransacao((tx) => fechamentoNaTransacao(tx, id, regra, presenca));
      if (mudou) resultado.feitas += 1;
      else resultado.jaResolvidas += 1;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      resultado.erros.push(`${id}: ${mensagem}`);
      console.error("[close-sessions]", id, mensagem);
    }
  }
  return resultado;
}
