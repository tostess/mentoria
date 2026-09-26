import { getSession } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { ParceiroIndisponivel, ProfissionalInvalido, reservar } from "@/lib/bookings";
import {
  HorarioIndisponivel,
  LancamentoRepetido,
  LimiteDePendentes,
  SaldoInsuficiente,
} from "@/lib/ledger/erros";

/**
 * `POST /api/bookings` — a ficha virando sessão.
 *
 * Route Handler e não Server Action porque a reserva vai ter mais de uma porta:
 * a tela de agendar da P4, o assistente da F11, a fila de espera da F7. A
 * transação mora em `lib/bookings` e é a mesma para todas.
 *
 * `api/*` está fora do matcher do `proxy.ts`, então este handler se protege
 * sozinho: sessão pelo cookie, papel conferido aqui, e `org_id` vindo do JWT —
 * nunca do corpo. Quem manda o POST escolhe **com quem** e **quando**, não por
 * qual empresa paga.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Corpo = { partnerId: string; inicio: Date };

/**
 * O corpo, validado na borda. Devolve a recusa como string para o handler
 * responder 422 — corpo malformado não é recusa de negócio e não merece o mesmo
 * código de quem tentou um horário ocupado.
 */
function lerCorpo(bruto: unknown): Corpo | string {
  if (typeof bruto !== "object" || bruto === null) return "Corpo inválido.";
  const dados = bruto as Record<string, unknown>;

  const partnerId = typeof dados.partnerId === "string" ? dados.partnerId.trim() : "";
  if (!UUID.test(partnerId)) return "`partnerId` precisa ser um uuid.";

  if (typeof dados.inicio !== "string") return "`inicio` precisa ser um instante ISO.";
  const inicio = new Date(dados.inicio);
  if (Number.isNaN(inicio.getTime())) return "`inicio` não é uma data válida.";

  /**
   * O instante tem de vir com fuso. `"2026-10-06T09:00"` sem `Z` nem offset é
   * interpretado como hora local do **servidor**, que não é o fuso de ninguém —
   * e o erro seria de horas, silencioso, no dado que mais importa.
   */
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(dados.inicio)) {
    return "`inicio` precisa trazer o fuso (por exemplo `2026-10-06T12:00:00Z`).";
  }

  return { partnerId, inicio };
}

export async function POST(request: Request) {
  const sessao = await getSession();
  if (sessao === null) {
    return Response.json({ erro: "Entre para agendar." }, { status: 401 });
  }
  if (sessao.role !== "professional" || sessao.orgId === null) {
    return Response.json({ erro: "Só o Profissional agenda sessão." }, { status: 403 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 422 });
  }

  const corpo = lerCorpo(bruto);
  if (typeof corpo === "string") {
    return Response.json({ erro: corpo }, { status: 422 });
  }

  try {
    const config = await loadAppConfig();
    const reserva = await reservar({
      orgId: sessao.orgId,
      partnerId: corpo.partnerId,
      professionalId: sessao.userId,
      inicio: corpo.inicio,
      agora: new Date(),
      config,
    });

    return Response.json(
      {
        id: reserva.bookingId,
        status: reserva.status,
        inicio: reserva.inicio.toISOString(),
        fim: reserva.fim.toISOString(),
        saldo: reserva.saldoCarteira,
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    /**
     * As recusas conhecidas viram 409 com a frase que a pessoa lê. Todas as
     * outras viram 500 sem detalhe: erro de banco não é problema de quem pediu, e
     * o texto do Postgres não vai para a rede.
     */
    if (
      erro instanceof HorarioIndisponivel ||
      erro instanceof LimiteDePendentes ||
      erro instanceof SaldoInsuficiente ||
      erro instanceof ParceiroIndisponivel ||
      erro instanceof ProfissionalInvalido ||
      erro instanceof LancamentoRepetido
    ) {
      return Response.json(
        { erro: erro.message, motivo: erro.name },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }

    console.error("[bookings] reserva falhou:", erro instanceof Error ? erro.message : erro);
    return Response.json({ erro: "Não foi possível agendar agora." }, { status: 500 });
  }
}
