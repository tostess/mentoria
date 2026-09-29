import { responderAoCancelamento } from "@/lib/bookings/resposta-http";

/**
 * `POST /api/bookings/:id/cancelar` — o Profissional ou o Parceiro cancela a
 * própria sessão até a sala abrir (F7). Corpo `{ estorna, compensa }`: o que a
 * tela disse que ia acontecer com a ficha. Se o prazo virou no meio, 409.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return responderAoCancelamento(request, params);
}
