import type postgres from "postgres";
import { paraInstante } from "@/lib/db/instantes";
import { HorarioIndisponivel, LimiteDePendentes } from "@/lib/ledger/erros";
import { chaveGasto } from "@/lib/ledger/keys";
import {
  avaliarSlots,
  type Avaliacao as AvaliacaoDeSlot,
  type DiaDaSemana,
  type Excecao,
  type Limites,
  type Ocupacao,
  type RegraSemanal,
  type Slot,
} from "@/lib/scheduling";

/**
 * A reserva. Invariante 6: validar o horário → lançar `spend` → inserir o
 * booking, tudo na mesma transação. Uma falha derruba as três.
 *
 * Recebe a transação, como `ledger/operacoes.ts`, e pelo mesmo motivo: é o que
 * deixa o teste chamar esta função e não uma cópia do SQL.
 *
 * **Roda privilegiada, e tem de rodar.** Não dá para reusar
 * `lib/parceiro/dados.ts`, que lê sob a sessão do próprio Parceiro: a policy de
 * `bookings` não deixa um Profissional ver sessão de terceiro — o que é correto,
 * e é exatamente por isso que a validação não pode acontecer do lado dele. Quem
 * agenda precisa saber que o horário está ocupado sem poder saber por quem.
 */

export type Pedido = {
  /**
   * Sorteado pela aplicação **antes** da transação.
   *
   * É o que permite a chave `spend_{bookingId}` existir antes da linha e o
   * `wallet_ledger.booking_id` apontar para o booking no mesmo insert. Mesmo
   * truque de `pessoas/criar.ts` com a identidade.
   */
  bookingId: string;
  orgId: string;
  partnerId: string;
  professionalId: string;
  /** O instante pedido. Nunca aceito como verdade — reconferido no motor. */
  inicio: Date;
  /** Parâmetro, não `new Date()`: é o que deixa a reserva ser testável. */
  agora: Date;
  limites: Limites;
  precoFichas: number;
  maxPendentes: number;
  criadoVia?: string;
};

export type Reserva = {
  bookingId: string;
  status: "pending" | "confirmed";
  inicio: Date;
  fim: Date;
  saldoCarteira: number;
};

export class ParceiroIndisponivel extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ParceiroIndisponivel";
  }
}

export class ProfissionalInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ProfissionalInvalido";
  }
}

/**
 * Leitura serve dentro de transação (a reserva) ou fora dela (a tela). O tipo
 * aceita os dois para que sejam **as mesmas funções** nos dois lugares.
 */
type Conexao = postgres.Sql | postgres.TransactionSql;

type LinhaDoParceiro = {
  fuso: string;
  buffer_min: number;
  max_per_week: number;
  auto_confirm: boolean;
  status: string;
};

export async function reservaNaTransacao(
  tx: postgres.TransactionSql,
  pedido: Pedido,
): Promise<Reserva> {
  /**
   * A carteira é travada primeiro, antes de qualquer leitura.
   *
   * Dois efeitos, e os dois são necessários. O óbvio é ler o saldo sem corrida.
   * O menos óbvio é que travar a carteira serializa **todas** as reservas deste
   * Profissional — sem isso, dois pedidos simultâneos dele passariam os dois
   * pela contagem de pendentes e o teto de `max_pending_per_professional` valeria
   * como sugestão.
   */
  const [carteira] = await tx<{ balance: number; org_id: string }[]>`
    select balance, org_id from wallets where user_id = ${pedido.professionalId} for update`;

  if (!carteira) {
    throw new ProfissionalInvalido("Você ainda não tem carteira. Fale com o RH da sua empresa.");
  }
  if (carteira.org_id !== pedido.orgId) {
    // A empresa vem do JWT, mas a carteira é quem diz a verdade (invariante 13).
    throw new ProfissionalInvalido("Sua carteira é de outra empresa.");
  }

  const [profissional] = await tx<{ active: boolean; role: string }[]>`
    select active, role::text from profiles
     where id = ${pedido.professionalId} and deleted_at is null`;

  if (!profissional || profissional.role !== "professional" || !profissional.active) {
    throw new ProfissionalInvalido("Seu acesso está inativo.");
  }

  const [pendentes] = await tx<{ n: number }[]>`
    select count(*)::int as n from bookings
     where professional_id = ${pedido.professionalId} and status = 'pending'`;

  if (pendentes.n >= pedido.maxPendentes) {
    throw new LimiteDePendentes(
      pedido.maxPendentes === 1
        ? "Você já tem um pedido esperando resposta. Aguarde antes de marcar outro."
        : `Você já tem ${pendentes.n} pedidos esperando resposta. O limite é ${pedido.maxPendentes}.`,
    );
  }

  /**
   * Invariante 14 aplicada na **escrita**, não só na leitura.
   *
   * O instante que chega do cliente é tratado como palpite: a agenda é
   * recalculada aqui e o horário tem de estar entre os livres. Sem isto, a
   * validação inteira do motor — descanso, teto semanal, aviso mínimo, férias —
   * viraria enfeite de tela, contornável por um `curl`.
   */
  const { parceiro, avaliacoes } = await avaliarAgenda(tx, {
    partnerId: pedido.partnerId,
    agora: pedido.agora,
    limites: pedido.limites,
  });

  const alvo = pedido.inicio.getTime();
  const candidato = avaliacoes.find((a) => a.slot.inicio.getTime() === alvo);

  if (candidato === undefined) {
    throw new HorarioIndisponivel("Esse horário não está na agenda deste Parceiro.");
  }
  if (candidato.recusa !== null) {
    throw new HorarioIndisponivel(PORQUE[candidato.recusa]);
  }

  const slot = candidato.slot;

  // Invariante 6, na ordem do fluxo da ficha: `spend` primeiro, booking depois.
  const [gasto] = await tx<{ balance_after: number }[]>`
    insert into wallet_ledger (user_id, org_id, type, amount, balance_after, booking_id, by_user_id, idempotency_key)
    values (${pedido.professionalId}, ${pedido.orgId}, 'spend', ${-pedido.precoFichas}, 0,
            ${pedido.bookingId}, ${pedido.professionalId}, ${chaveGasto(pedido.bookingId)})
    returning balance_after`;

  const status = parceiro.auto_confirm ? "confirmed" : "pending";

  /**
   * A sobreposição não é conferida aqui. O `insert` abaixo bate na constraint de
   * exclusão (invariante 7) se alguém tiver pegado o horário no intervalo entre
   * a avaliação do motor e esta linha — e é o banco que tem de decidir isso,
   * porque checagem prévia perde a corrida e constraint não perde.
   */
  const [booking] = await tx<{ id: string; start_at: string; end_at: string }[]>`
    insert into bookings (id, org_id, partner_id, professional_id, start_at, end_at,
                          duration_min, price_fichas, status, created_via, confirmed_at)
    values (${pedido.bookingId}, ${pedido.orgId}, ${pedido.partnerId}, ${pedido.professionalId},
            ${paraInstante(slot.inicio)}::text::timestamptz,
            ${paraInstante(slot.fim)}::text::timestamptz,
            ${pedido.limites.duracaoMin}, ${pedido.precoFichas}, ${status}::booking_status,
            ${pedido.criadoVia ?? "search"},
            ${paraInstante(status === "confirmed" ? slot.inicio : null)}::text::timestamptz )
    returning id, start_at, end_at`;

  /**
   * Sem `audit_logs`: a invariante 12 pede registro de ação de admin, moderador e
   * RH — ação sobre terceiro. Profissional agendando para si não é, e o
   * `wallet_ledger` já guarda o `spend` com o `booking_id`, que é o registro que
   * importa. Mesma regra aplicada ao Parceiro na P2.
   */
  return {
    bookingId: booking.id,
    status,
    inicio: new Date(booking.start_at),
    fim: new Date(booking.end_at),
    saldoCarteira: gasto.balance_after,
  };
}

/**
 * A agenda de um Parceiro avaliada pelo motor: cada horário candidato com o
 * motivo da recusa, ou `null` quando está livre.
 *
 * **É a leitura da reserva e a leitura da tela, a mesma função.** Se a página do
 * Parceiro lesse regras, exceções e ocupação por outro caminho, bastaria uma
 * diferença de recorte — um status a mais, um fuso diferente — para a tela
 * oferecer horário que a reserva recusa. Invariante 14: todo horário exibido
 * sai do motor, e daqui.
 *
 * Roda privilegiada pelo mesmo motivo da reserva: a ocupação inclui sessões de
 * outras pessoas, que a policy de `bookings` corretamente esconde. O que sai
 * daqui são intervalos, nunca de quem é a sessão.
 */
export async function avaliarAgenda(
  tx: Conexao,
  { partnerId, agora, limites }: { partnerId: string; agora: Date; limites: Limites },
): Promise<{ parceiro: LinhaDoParceiro; avaliacoes: AvaliacaoDeSlot[] }> {
  const parceiro = await lerParceiro(tx, partnerId);
  const regras = await lerRegras(tx, partnerId);
  const excecoes = await lerExcecoes(tx, partnerId);
  const ocupacoes = await lerOcupacoes(tx, partnerId, agora);

  const avaliacoes = avaliarSlots({
    agora,
    parceiro: {
      fuso: parceiro.fuso,
      bufferMin: parceiro.buffer_min,
      maxPorSemana: parceiro.max_per_week,
      regras,
      excecoes,
    },
    ocupacoes,
    limites,
  });

  return { parceiro, avaliacoes };
}

/** Só os horários livres, em ordem. É o que a tela do Profissional mostra. */
export async function horariosLivresNaConexao(
  tx: Conexao,
  consulta: { partnerId: string; agora: Date; limites: Limites },
): Promise<Slot[]> {
  const { avaliacoes } = await avaliarAgenda(tx, consulta);
  return avaliacoes.filter((a) => a.recusa === null).map((a) => a.slot);
}

/** A recusa do motor vira frase. O motivo cru não serve para ninguém ler. */
const PORQUE: Record<string, string> = {
  "fora-do-aviso-minimo": "Esse horário está perto demais de agora.",
  "fora-do-horizonte": "Esse horário está além do que a agenda abre.",
  ocupado: "Esse horário acabou de ser tomado. Escolha outro.",
  descanso: "Esse horário fica colado em outra sessão do Parceiro.",
  "teto-semanal": "O Parceiro já atingiu o limite de sessões nessa semana.",
  "hora-inexistente": "Esse horário não existe no fuso do Parceiro.",
};

async function lerParceiro(
  tx: Conexao,
  partnerId: string,
): Promise<LinhaDoParceiro> {
  const [linha] = await tx<LinhaDoParceiro[]>`
    select pr.timezone as fuso, pa.buffer_min, pa.max_per_week,
           pa.auto_confirm, pa.status::text as status
      from partners pa
      join profiles pr on pr.id = pa.id
     where pa.id = ${partnerId} and pr.deleted_at is null`;

  if (!linha) throw new ParceiroIndisponivel("Parceiro não encontrado.");

  // Invariante 8 do lado da leitura: só `active` recebe sessão. Pausado honra o
  // que já está marcado e não aceita novo — é o que "pausar" significa.
  if (linha.status !== "active") {
    throw new ParceiroIndisponivel("Este Parceiro não está aceitando sessões agora.");
  }
  return linha;
}

async function lerRegras(
  tx: Conexao,
  partnerId: string,
): Promise<RegraSemanal[]> {
  const linhas = await tx<
    {
      weekday: number;
      start_min: number;
      end_min: number;
      effective_from: string | null;
      effective_to: string | null;
    }[]
  >`
    select weekday, start_min, end_min, effective_from, effective_to
      from partner_rules where partner_id = ${partnerId} order by weekday`;

  return linhas.map((l) => ({
    diaDaSemana: l.weekday as DiaDaSemana,
    inicioMin: l.start_min,
    fimMin: l.end_min,
    valeDe: comoData(l.effective_from),
    valeAte: comoData(l.effective_to),
  }));
}

async function lerExcecoes(tx: Conexao, partnerId: string): Promise<Excecao[]> {
  const linhas = await tx<
    { day: string; kind: string; start_min: number | null; end_min: number | null }[]
  >`
    select day, kind, start_min, end_min
      from partner_exceptions where partner_id = ${partnerId}`;

  return linhas.map((l) => ({
    dia: comoData(l.day) ?? "",
    // O banco fala `block`/`extra`; o motor fala `bloqueio`/`extra`.
    tipo: l.kind === "block" ? ("bloqueio" as const) : ("extra" as const),
    inicioMin: l.start_min,
    fimMin: l.end_min,
  }));
}

/**
 * Toda a ocupação do Parceiro, não só a de quem está agendando.
 *
 * Mesmo recorte da constraint de exclusão (`pending` e `confirmed`): sessão
 * cancelada ou expirada não bloqueia horário, e incluí-la faria a agenda
 * encolher sozinha com o tempo.
 */
async function lerOcupacoes(
  tx: Conexao,
  partnerId: string,
  desde: Date,
): Promise<Ocupacao[]> {
  const linhas = await tx<{ start_at: string; end_at: string }[]>`
    select start_at, end_at from bookings
     where partner_id = ${partnerId}
       and status in ('pending', 'confirmed')
       and end_at >= ${paraInstante(desde)}::text::timestamptz`;

  return linhas.map((l) => ({ inicio: new Date(l.start_at), fim: new Date(l.end_at) }));
}

/**
 * Coluna `date` chega como `Date` ou string dependendo do driver; o motor quer
 * `YYYY-MM-DD`. Cortar o ISO resolve os dois casos sem passar por fuso.
 */
function comoData(valor: string | Date | null): string | null {
  if (valor === null) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor.slice(0, 10);
}
