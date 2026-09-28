import { getSession } from "@/lib/auth/session";
import { presenteRecebido } from "@/lib/video/dados";

/**
 * `GET /api/sessoes/:id/presente` — o Profissional pergunta, de 15 em 15 s,
 * se ganhou presente nesta sessão. Leitura pela RLS dele: só enxerga o próprio
 * extrato, e uma sessão de outra pessoa responde "não", como deveria.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { "cache-control": "no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSession();
  if (sessao === null) {
    return Response.json({ erro: "Entre para continuar." }, { status: 401, headers: SEM_CACHE });
  }
  if (sessao.role !== "professional") {
    return Response.json({ erro: "Só quem recebe pergunta." }, { status: 403, headers: SEM_CACHE });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return Response.json({ erro: "Sessão inválida." }, { status: 422, headers: SEM_CACHE });
  }

  try {
    const estado = await presenteRecebido(id, sessao.userId);
    return Response.json(estado, { status: 200, headers: SEM_CACHE });
  } catch (erro) {
    console.error("[presente] falhou:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível conferir agora." }, { status: 500, headers: SEM_CACHE });
  }
}
