import { labFechado } from "../_lib/cerca";
import { ErroDaily, type PropriedadesSala } from "../_lib/daily";
import { agoraEmSegundos, booleano, lerCorpo, nomeDeSalaValido, numero, recusar, texto } from "../_lib/entrada";
import { daily, exigirSessao } from "../_lib/servidor";

/**
 * SPIKE P5-0 — criar (ou reencontrar) uma sala e ler o estado dela.
 *
 * `POST { nome?, expiraEmMin, ejetarNoFim, nbfEmMin? }` → `garantirSala`.
 * `GET ?nome=` → configuração da sala e presença agora.
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

  const nome = texto(corpo, "nome") ?? crypto.randomUUID();
  if (!nomeDeSalaValido(nome)) return recusar("Nome de sala inválido.");

  const agora = agoraEmSegundos();
  const expiraEmMin = numero(corpo, "expiraEmMin") ?? 60;
  const nbfEmMin = numero(corpo, "nbfEmMin");
  const propriedades: PropriedadesSala = {
    exp: agora + Math.round(expiraEmMin * 60),
    eject_at_room_exp: booleano(corpo, "ejetarNoFim"),
    lang: "pt-BR",
    // Sessão 1:1. O Daily conta o dono também.
    max_participants: 2,
  };
  if (nbfEmMin !== null) propriedades.nbf = agora + Math.round(nbfEmMin * 60);

  try {
    const { sala, criada } = await daily().garantirSala(nome, propriedades);
    console.log(`[lab/video] sala ${sala.name} ${criada ? "criada" : "já existia"}`);
    return Response.json({ sala, criada, agora }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    return falha(erro);
  }
}

export async function GET(request: Request) {
  const fechado = labFechado();
  if (fechado) return fechado;
  const recusa = await exigirSessao();
  if (recusa) return recusa;

  const nome = new URL(request.url).searchParams.get("nome") ?? "";
  if (!nomeDeSalaValido(nome)) return recusar("Nome de sala inválido.");

  try {
    // Sequencial de propósito: é o mesmo cliente, e a ordem não importa aqui.
    const sala = await daily().lerSala(nome);
    if (sala === null) return recusar("Sala não existe.", 404);
    const presenca = await daily().presenca(nome);
    return Response.json(
      { sala, presenca, agora: agoraEmSegundos() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    return falha(erro);
  }
}

function falha(erro: unknown): Response {
  if (erro instanceof ErroDaily) {
    console.error("[lab/video]", erro.message);
    return Response.json({ erro: erro.message, tipo: erro.tipo }, { status: 502 });
  }
  throw erro;
}
