import "server-only";

import { marcarSala } from "@/lib/bookings";
import { createClient } from "@/lib/supabase/server";
import { daily, videoConfigurado } from "./index";
import { porta, propriedadesDaSala, propriedadesDoToken, type Janela } from "./sala";

/**
 * Entrar na sessão: conferir quem é, conferir a hora, e só então falar com o
 * Daily.
 *
 * A sessão é lida **pela RLS de quem pede** (participante da sessão, ou equipe
 * da operadora), e o participante é conferido de novo no código — a policy deixa
 * a equipe ler, e ler não é entrar. A única escrita, o `room_name`, vai por
 * conexão privilegiada (invariante 4), e antes do Daily: ver `marcarSala`.
 *
 * Nunca há transação aberta em volta das chamadas HTTP ao Daily.
 */

export class EntradaRecusada extends Error {
  readonly status: 404 | 409 | 503;
  readonly janela: Janela | null;

  constructor(status: 404 | 409 | 503, mensagem: string, janela: Janela | null = null) {
    super(mensagem);
    this.name = "EntradaRecusada";
    this.status = status;
    this.janela = janela;
  }
}

export type Entrada = {
  /** Endereço do Prebuilt já com o token. Usar uma vez: o Prebuilt apaga o `?t=`. */
  url: string;
  janela: Janela;
};

export async function entrarNaSessao(pedido: {
  bookingId: string;
  userId: string;
  agora: Date;
}): Promise<Entrada> {
  if (!videoConfigurado()) {
    throw new EntradaRecusada(503, "O vídeo ainda não está configurado neste ambiente.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, partner_id, professional_id, start_at, end_at, status")
    .eq("id", pedido.bookingId)
    .maybeSingle();
  if (error !== null) throw new Error(`sessão: ${error.message}`);

  const linha = (data ?? null) as Record<string, unknown> | null;
  const ehParceiro = linha?.partner_id === pedido.userId;
  const ehProfissional = linha?.professional_id === pedido.userId;
  if (linha === null || (!ehParceiro && !ehProfissional)) {
    throw new EntradaRecusada(404, "Não encontramos essa sessão na sua agenda.");
  }

  const inicio = new Date(String(linha.start_at));
  const fim = new Date(String(linha.end_at));
  const agora = porta({ status: String(linha.status), inicio, fim }, pedido.agora);
  if (!agora.aberta) {
    const mensagem =
      agora.motivo === "cedo"
        ? "A sala ainda não abriu."
        : agora.motivo === "encerrada"
          ? "Esta sessão já terminou."
          : "Esta sessão não está confirmada.";
    throw new EntradaRecusada(409, mensagem, agora.janela);
  }

  const perfil = await supabase.from("profiles").select("name").eq("id", pedido.userId).maybeSingle();
  if (perfil.error !== null) throw new Error(`perfil: ${perfil.error.message}`);
  const nome = String((perfil.data as Record<string, unknown> | null)?.name ?? "");

  await marcarSala(pedido.bookingId);

  const cliente = daily();
  const { sala } = await cliente.garantirSala(pedido.bookingId, propriedadesDaSala(inicio, fim));
  const token = await cliente.emitirToken(
    propriedadesDoToken(pedido.bookingId, inicio, fim, { userId: pedido.userId, nome, ehParceiro }),
  );

  return { url: `${sala.url}?t=${encodeURIComponent(token)}`, janela: agora.janela };
}
