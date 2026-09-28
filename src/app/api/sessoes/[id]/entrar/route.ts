import { getSession } from "@/lib/auth/session";
import { ErroDaily } from "@/lib/video/daily";
import { EntradaRecusada, entrarNaSessao } from "@/lib/video/entrada";

/**
 * `POST /api/sessoes/:id/entrar` — devolve o endereço da sala com um token novo.
 *
 * Só o Profissional dono e o Parceiro da sessão, lidos do JWT (invariante 19).
 * Um token por chamada, nunca guardado: a tela pede outro a cada vez que monta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CACHE = { "cache-control": "no-store" };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSession();
  if (sessao === null) {
    return Response.json({ erro: "Entre para acessar a sala." }, { status: 401, headers: SEM_CACHE });
  }
  if (sessao.role !== "professional" && sessao.role !== "partner") {
    return Response.json({ erro: "A sala é só de quem participa da sessão." }, { status: 403, headers: SEM_CACHE });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return Response.json({ erro: "Sessão inválida." }, { status: 422, headers: SEM_CACHE });
  }

  try {
    const entrada = await entrarNaSessao({ bookingId: id, userId: sessao.userId, agora: new Date() });
    return Response.json(
      {
        ok: true,
        url: entrada.url,
        abre: entrada.janela.abre.toISOString(),
        fecha: entrada.janela.fecha.toISOString(),
      },
      { status: 200, headers: SEM_CACHE },
    );
  } catch (erro) {
    if (erro instanceof EntradaRecusada) {
      return Response.json(
        {
          erro: erro.message,
          abre: erro.janela?.abre.toISOString() ?? null,
          fecha: erro.janela?.fecha.toISOString() ?? null,
        },
        { status: erro.status, headers: SEM_CACHE },
      );
    }
    if (erro instanceof ErroDaily) {
      console.error("[entrar] Daily:", erro.message);
      return Response.json(
        { erro: "O serviço de vídeo não respondeu. Tente de novo em instantes." },
        { status: 502, headers: SEM_CACHE },
      );
    }
    console.error("[entrar] falhou:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível abrir a sala agora." }, { status: 500, headers: SEM_CACHE });
  }
}
