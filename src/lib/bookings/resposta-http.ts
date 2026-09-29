import "server-only";

import { getSession } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { LancamentoRepetido } from "@/lib/ledger/erros";
import { cancelarSessao } from "./index";
import {
  CancelamentoRecusado,
  CorrecaoRecusada,
  PedidoJaRespondido,
  SessaoNaoEncontrada,
} from "./transicoes";

/**
 * O que confirmar e recusar têm em comum: quem pode, o id na rota, e como cada
 * recusa vira código HTTP. Os dois handlers ficam com uma linha de diferença —
 * a transição que chamam.
 *
 * `partnerId` vem do JWT (invariante 19), nunca do corpo: quem clica escolhe
 * **qual** pedido, não **de quem** ele é. Sessão de outro Parceiro responde
 * 404, igual a sessão inexistente.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { "cache-control": "no-store" };

export async function responderAoPedido<T extends object | void>(
  params: Promise<{ id: string }>,
  rotulo: string,
  acao: (resposta: { bookingId: string; partnerId: string; agora: Date }) => Promise<T>,
): Promise<Response> {
  const sessao = await getSession();
  if (sessao === null) {
    return Response.json({ erro: "Entre para responder." }, { status: 401, headers: SEM_CACHE });
  }
  if (sessao.role !== "partner") {
    return Response.json({ erro: "Só o Parceiro da sessão responde." }, { status: 403, headers: SEM_CACHE });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return Response.json({ erro: "Pedido inválido." }, { status: 422, headers: SEM_CACHE });
  }

  try {
    const retorno = await acao({ bookingId: id, partnerId: sessao.userId, agora: new Date() });
    return Response.json({ ok: true, ...(retorno ?? {}) }, { status: 200, headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof SessaoNaoEncontrada) {
      return Response.json({ erro: erro.message, motivo: erro.name }, { status: 404, headers: SEM_CACHE });
    }
    if (
      erro instanceof PedidoJaRespondido ||
      erro instanceof CorrecaoRecusada ||
      erro instanceof LancamentoRepetido
    ) {
      return Response.json({ erro: erro.message, motivo: erro.name }, { status: 409, headers: SEM_CACHE });
    }
    console.error(`[${rotulo}] falhou:`, erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível responder agora." }, { status: 500, headers: SEM_CACHE });
  }
}

function lerEsperado(corpo: unknown): { estorna: boolean; compensa: boolean } | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const { estorna, compensa } = corpo as Record<string, unknown>;
  if (typeof estorna !== "boolean" || typeof compensa !== "boolean") return null;
  return { estorna, compensa };
}

/**
 * `POST /api/bookings/:id/cancelar`, dos dois lados. O lado sai do papel no JWT
 * e o id de quem cancela também (invariante 19); o corpo diz só o que a tela
 * prometeu — `{ estorna, compensa }` —, e é obrigatório: sem ele não há como
 * saber se a pessoa leu a frase certa antes de a ficha se mover.
 */
export async function responderAoCancelamento(
  request: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const sessao = await getSession();
  if (sessao === null) {
    return Response.json({ erro: "Entre para cancelar." }, { status: 401, headers: SEM_CACHE });
  }
  if (sessao.role !== "professional" && sessao.role !== "partner") {
    return Response.json(
      { erro: "Só quem participa da sessão pode cancelá-la." },
      { status: 403, headers: SEM_CACHE },
    );
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return Response.json({ erro: "Sessão inválida." }, { status: 422, headers: SEM_CACHE });
  }
  const esperado = lerEsperado(await request.json().catch(() => null));
  if (esperado === null) {
    return Response.json({ erro: "Pedido incompleto." }, { status: 422, headers: SEM_CACHE });
  }

  const config = await loadAppConfig();
  try {
    const resultado = await cancelarSessao({
      bookingId: id,
      ator: { id: sessao.userId, lado: sessao.role },
      agora: new Date(),
      janelaHoras: config.fichaPolicy.cancelWindowHours,
      compensacao: config.fichaPolicy.partnerNoShowBonus,
      esperado,
    });
    return Response.json({ ok: true, ...resultado }, { status: 200, headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof SessaoNaoEncontrada) {
      return Response.json(
        { erro: "Não encontramos essa sessão na sua agenda.", motivo: erro.name },
        { status: 404, headers: SEM_CACHE },
      );
    }
    if (erro instanceof CancelamentoRecusado || erro instanceof LancamentoRepetido) {
      return Response.json({ erro: erro.message, motivo: erro.name }, { status: 409, headers: SEM_CACHE });
    }
    console.error("[cancelar] falhou:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível cancelar agora." }, { status: 500, headers: SEM_CACHE });
  }
}
