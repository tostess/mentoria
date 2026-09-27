import { labFechado } from "../_lib/cerca";
import { ErroDaily } from "../_lib/daily";
import { agoraEmSegundos, lerCorpo, nomeDeSalaValido, numero, recusar, texto } from "../_lib/entrada";
import { daily, exigirSessao } from "../_lib/servidor";

/**
 * SPIKE P5-0 — pergunta 3: prorrogar uma chamada em andamento.
 *
 * Hipótese: o fim da sessão vive na **sala** (`exp` + `eject_at_room_exp`),
 * não no token; prorrogar é `POST /rooms/:name` com `exp` novo.
 *
 * `POST { sala, minutos }` soma ao `exp` atual;
 * `POST { sala, expEmMin }` põe o `exp` a N minutos de agora (para medir).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fechado = labFechado();
  if (fechado) return fechado;
  const recusa = await exigirSessao();
  if (recusa) return recusa;

  const corpo = await lerCorpo(request);
  if (corpo === null) return recusar("Corpo inválido.");
  const nome = texto(corpo, "sala") ?? "";
  if (!nomeDeSalaValido(nome)) return recusar("Nome de sala inválido.");

  const minutos = numero(corpo, "minutos");
  const expEmMin = numero(corpo, "expEmMin");
  if (minutos === null && expEmMin === null) return recusar("Informe minutos ou expEmMin.");

  try {
    const sala = await daily().lerSala(nome);
    if (sala === null) return recusar("Sala não existe.", 404);

    const agora = agoraEmSegundos();
    const antes = typeof sala.config.exp === "number" ? sala.config.exp : null;
    const depois =
      expEmMin !== null
        ? agora + Math.round(expEmMin * 60)
        : Math.max(antes ?? agora, agora) + Math.round((minutos ?? 0) * 60);

    const atualizada = await daily().atualizarSala(nome, { exp: depois });
    console.log(`[lab/video] estender ${nome}: exp ${antes} → ${depois}`);
    return Response.json(
      { antes, depois, agora, sala: atualizada },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    if (erro instanceof ErroDaily) {
      console.error("[lab/video]", erro.message);
      return Response.json({ erro: erro.message, tipo: erro.tipo }, { status: 502 });
    }
    throw erro;
  }
}
