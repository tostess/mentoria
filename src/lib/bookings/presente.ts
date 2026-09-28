import type postgres from "postgres";
import { DateTime } from "luxon";
import { chavePresente, periodo } from "@/lib/ledger/keys";
import { FUSO_DA_PLATAFORMA } from "@/lib/ledger/mensal";
import { presenteNaTransacao } from "@/lib/ledger/operacoes";
import { FECHA_DEPOIS_MIN } from "@/lib/video/sala";
import { SessaoNaoEncontrada } from "./transicoes";

/**
 * O presente do Parceiro, dentro da sala (invariante 20): 1 ficha por sessão,
 * dentro da cota mensal dele, do início da sessão até a sala fechar.
 *
 * Mesmo desenho das transições: recebe a transação, sem `server-only`, para o
 * teste chamar a função que a aplicação chama.
 */

/** Frase do extrato. Sem nome de ninguém: o livro-caixa é imutável e sobrevive à anonimização. */
export const MOTIVO_PRESENTE = "Presente recebido na sessão";

export class PresenteRecusado extends Error {
  readonly motivo: "nao-confirmada" | "fora-da-sala" | "ja-presenteou" | "sem-cota";

  constructor(motivo: PresenteRecusado["motivo"], mensagem: string) {
    super(mensagem);
    this.name = "PresenteRecusado";
    this.motivo = motivo;
  }
}

export type PedidoDePresente = {
  bookingId: string;
  /** Vem do JWT, nunca do corpo (invariante 19). */
  partnerId: string;
  agora: Date;
};

export type CotaDoMes = { cota: number; usados: number };

/** `YYYYMM` do mês de São Paulo — a mesma fronteira da recarga mensal. */
export function periodoDoPresente(agora: Date): string {
  const local = DateTime.fromJSDate(agora, { zone: FUSO_DA_PLATAFORMA });
  return periodo(local.year, local.month);
}

export async function presenteNaSessao(
  tx: postgres.TransactionSql,
  pedido: PedidoDePresente,
): Promise<CotaDoMes> {
  // A trava da sessão serializa os dois celulares do Parceiro apertando juntos:
  // o segundo espera, relê e encontra o presente do primeiro.
  const [sessao] = await tx<{ status: string; start_at: string; end_at: string }[]>`
    select status::text, start_at, end_at from bookings
     where id = ${pedido.bookingId} and partner_id = ${pedido.partnerId}
       for update`;
  if (!sessao) throw new SessaoNaoEncontrada();

  if (sessao.status !== "confirmed") {
    throw new PresenteRecusado("nao-confirmada", "Só dá para presentear numa sessão confirmada.");
  }

  const agora = pedido.agora.getTime();
  const fecha = new Date(sessao.end_at).getTime() + FECHA_DEPOIS_MIN * 60_000;
  if (agora < new Date(sessao.start_at).getTime() || agora >= fecha) {
    throw new PresenteRecusado("fora-da-sala", "O presente só pode ser dado durante a sessão.");
  }

  const [dado] = await tx<{ n: number }[]>`
    select count(*)::int as n from wallet_ledger
     where idempotency_key = ${chavePresente(pedido.bookingId)}`;
  if (dado.n > 0) {
    throw new PresenteRecusado("ja-presenteou", "Você já deu um presente nesta sessão.");
  }

  const [parceiro] = await tx<{ gift_quota_monthly: number }[]>`
    select gift_quota_monthly from partners where id = ${pedido.partnerId}`;
  const cota = parceiro?.gift_quota_monthly ?? 0;
  const mes = periodoDoPresente(pedido.agora);

  /**
   * Conferir e gastar a cota num comando só. Ler `gifts_used` e depois somar
   * perderia a corrida entre duas sessões do mesmo Parceiro no mesmo minuto; o
   * `where` do `on conflict` só soma se ainda couber, e sem linha devolvida é
   * cota esgotada.
   */
  const [gasto] =
    cota <= 0
      ? []
      : await tx<{ gifts_used: number }[]>`
          insert into gift_quotas (partner_id, period, gifts_used)
          values (${pedido.partnerId}, ${mes}, 1)
          on conflict (partner_id, period) do update
             set gifts_used = gift_quotas.gifts_used + 1
           where gift_quotas.gifts_used < ${cota}
          returning gifts_used`;

  if (!gasto) {
    throw new PresenteRecusado(
      "sem-cota",
      `Você já deu ${cota === 1 ? "o presente" : `os ${cota} presentes`} deste mês.`,
    );
  }

  await presenteNaTransacao(tx, {
    bookingId: pedido.bookingId,
    ator: { id: pedido.partnerId, role: "partner" },
    motivo: MOTIVO_PRESENTE,
  });

  return { cota, usados: gasto.gifts_used };
}

/**
 * A cota do mês e se esta sessão já recebeu presente — o que a sala do Parceiro
 * mostra. Leitura privilegiada com o Parceiro no `where`: a policy de
 * `wallet_ledger` não deixa o Parceiro ler a carteira de outra pessoa, e é certo
 * que não deixe; aqui ele só fica sabendo do lançamento que ele mesmo fez.
 */
export async function estadoDoPresente(
  sql: postgres.Sql | postgres.TransactionSql,
  pedido: PedidoDePresente,
): Promise<CotaDoMes & { dadoNestaSessao: boolean }> {
  const [linha] = await sql<{ cota: number; usados: number | null; dado: boolean }[]>`
    select p.gift_quota_monthly as cota,
           q.gifts_used         as usados,
           exists (select 1 from wallet_ledger w
                    where w.idempotency_key = ${chavePresente(pedido.bookingId)}
                      and w.by_user_id = ${pedido.partnerId}) as dado
      from partners p
      left join gift_quotas q on q.partner_id = p.id and q.period = ${periodoDoPresente(pedido.agora)}
     where p.id = ${pedido.partnerId}`;
  return {
    cota: linha?.cota ?? 0,
    usados: linha?.usados ?? 0,
    dadoNestaSessao: linha?.dado ?? false,
  };
}
