import { PresenteRecusado, SessaoNaoEncontrada, presentear } from "@/lib/bookings";
import { getSession } from "@/lib/auth/session";
import { LancamentoRepetido } from "@/lib/ledger/erros";

/**
 * `POST /api/sessoes/:id/presentear` — o Parceiro dá 1 ficha a quem está na
 * sala com ele (invariante 20). Escrita privilegiada (invariante 4); o
 * `partner_id` vem do JWT, nunca do corpo.
 *
 * A resposta leva a cota do mês e **não** o saldo de quem recebeu: é dinheiro do
 * Profissional, e quem pergunta é o Parceiro.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { "cache-control": "no-store" };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSession();
  if (sessao === null) {
    return Response.json({ erro: "Entre para presentear." }, { status: 401, headers: SEM_CACHE });
  }
  if (sessao.role !== "partner") {
    return Response.json({ erro: "Só quem conduz a sessão pode presentear." }, { status: 403, headers: SEM_CACHE });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return Response.json({ erro: "Sessão inválida." }, { status: 422, headers: SEM_CACHE });
  }

  try {
    const cota = await presentear({ bookingId: id, partnerId: sessao.userId, agora: new Date() });
    return Response.json({ ok: true, ...cota }, { status: 200, headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof SessaoNaoEncontrada) {
      return Response.json({ erro: erro.message }, { status: 404, headers: SEM_CACHE });
    }
    if (erro instanceof PresenteRecusado) {
      return Response.json({ erro: erro.message, motivo: erro.motivo }, { status: 409, headers: SEM_CACHE });
    }
    if (erro instanceof LancamentoRepetido) {
      return Response.json(
        { erro: "Você já deu um presente nesta sessão.", motivo: "ja-presenteou" },
        { status: 409, headers: SEM_CACHE },
      );
    }
    console.error("[presentear] falhou:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível registrar o presente agora." }, { status: 500, headers: SEM_CACHE });
  }
}
