import { corrigirPresenca } from "@/lib/bookings";
import { responderAoPedido } from "@/lib/bookings/resposta-http";

/**
 * `POST /api/sessoes/:id/presenca` — o Parceiro corrige a presença do
 * Profissional que a sala deu como ausente (invariante 18). Só o Parceiro da
 * sessão, lido do JWT; grava `audit_logs` na mesma transação.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return responderAoPedido(params, "corrigir-presenca", async (resposta) => {
    await corrigirPresenca(resposta);
  });
}
