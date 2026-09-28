import { confirmarPedido } from "@/lib/bookings";
import { responderAoPedido } from "@/lib/bookings/resposta-http";

/**
 * `POST /api/bookings/:id/confirmar` — o Parceiro aceita o pedido.
 *
 * Escrita com `service_role` (invariante 4): não há policy de `update` em
 * `bookings` para papel autenticado, e não vai haver. Parceiro agindo na
 * própria sessão não grava `audit_logs`, como na P2.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return responderAoPedido(params, "confirmar", confirmarPedido);
}
