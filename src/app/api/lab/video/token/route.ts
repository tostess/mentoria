import { labFechado } from "../_lib/cerca";
import { ErroDaily, type PropriedadesToken } from "../_lib/daily";
import { agoraEmSegundos, booleano, lerCorpo, nomeDeSalaValido, numero, recusar, texto } from "../_lib/entrada";
import { daily, exigirSessao } from "../_lib/servidor";

/**
 * SPIKE P5-0 — emitir token de reunião.
 *
 * `POST { sala, papel, nome, nbfEmMin?, expEmMin?, ejetarNoExp, prejoin }`.
 * `is_owner` só para o lado Parceiro. Devolve o token e a URL da sala com
 * `?t=`, que é como o Daily Prebuilt recebe o token sem `daily-js`.
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

  const nomeSala = texto(corpo, "sala") ?? "";
  if (!nomeDeSalaValido(nomeSala)) return recusar("Nome de sala inválido.");
  const papel = texto(corpo, "papel");
  if (papel !== "parceiro" && papel !== "profissional") return recusar("Papel inválido.");

  const agora = agoraEmSegundos();
  const nbfEmMin = numero(corpo, "nbfEmMin");
  const expEmMin = numero(corpo, "expEmMin");

  const propriedades: PropriedadesToken = {
    room_name: nomeSala,
    user_name: texto(corpo, "nome") ?? (papel === "parceiro" ? "Parceiro" : "Profissional"),
    user_id: `${papel}-${crypto.randomUUID().slice(0, 8)}`,
    is_owner: papel === "parceiro",
    enable_prejoin_ui: booleano(corpo, "prejoin"),
    lang: "pt-BR",
  };
  if (nbfEmMin !== null) propriedades.nbf = agora + Math.round(nbfEmMin * 60);
  if (expEmMin !== null) propriedades.exp = agora + Math.round(expEmMin * 60);
  // Só manda a propriedade quando ligada: a documentação diz que a mera
  // presença de uma propriedade de expulsão no token anula as da sala.
  if (booleano(corpo, "ejetarNoExp")) propriedades.eject_at_token_exp = true;

  try {
    const sala = await daily().lerSala(nomeSala);
    if (sala === null) return recusar("Sala não existe.", 404);
    const token = await daily().emitirToken(propriedades);
    return Response.json(
      { token, url: `${sala.url}?t=${token}`, propriedades, agora },
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
