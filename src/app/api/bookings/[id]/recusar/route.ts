import { recusarPedido } from "@/lib/bookings";
import { responderAoPedido } from "@/lib/bookings/resposta-http";

/**
 * `POST /api/bookings/:id/recusar` — o Parceiro recusa, e a ficha volta na
 * mesma transação (decisão da P4). O saldo novo da carteira **não** vai na
 * resposta: é dinheiro do Profissional, e quem pergunta é o Parceiro.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return responderAoPedido(params, "recusar", async (resposta) => {
    await recusarPedido(resposta);
  });
}
