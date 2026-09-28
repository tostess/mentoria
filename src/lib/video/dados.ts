import "server-only";

import { chavePresente } from "@/lib/ledger/keys";
import { createClient } from "@/lib/supabase/server";

/**
 * O que a sala e a tela de fim mostram, lido **pela sessão de quem abre**.
 *
 * `bookings` pela policy de participante; a pessoa do outro lado pelo mesmo
 * caminho das agendas — o Profissional lê o perfil do Parceiro ativo, o Parceiro
 * lê quem marcou com ele pela view `partner_professionals`. A policy de
 * `bookings` também deixa a equipe da operadora ler, e ler não é participar: o
 * participante é conferido de novo aqui, pelo papel do JWT.
 */

export type PapelNaSala = "professional" | "partner";

export type PessoaNaSala = {
  id: string;
  nome: string;
  foto: string | null;
  /** Cargo e empresa (quem pediu) ou a chamada (o Parceiro). */
  linha: string | null;
};

export type DadosDaSala = {
  id: string;
  papel: PapelNaSala;
  status: string;
  inicio: Date;
  fim: Date;
  /** Fuso de quem olha — a borda de UI converte para ele. */
  fuso: string;
  eu: { id: string; nome: string };
  outro: PessoaNaSala;
};

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function instante(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `null` quando a sessão não existe ou não é de quem pergunta — a tela diz o mesmo nos dois casos. */
export async function carregarSala(
  bookingId: string,
  userId: string,
  papel: PapelNaSala,
  /** O termo que aparece no lugar do nome, quando o perfil do outro lado não é legível. */
  nomePadrao: string,
): Promise<DadosDaSala | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, partner_id, professional_id, start_at, end_at, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (error !== null) throw new Error(`sessão: ${error.message}`);

  const linha = (data ?? null) as Record<string, unknown> | null;
  if (linha === null) return null;
  const meuLado = papel === "partner" ? linha.partner_id : linha.professional_id;
  const outroId = papel === "partner" ? linha.professional_id : linha.partner_id;
  const inicio = instante(linha.start_at);
  const fim = instante(linha.end_at);
  if (meuLado !== userId || typeof outroId !== "string" || !inicio || !fim) return null;

  const eu = await supabase.from("profiles").select("name, timezone").eq("id", userId).maybeSingle();
  if (eu.error !== null) throw new Error(`perfil: ${eu.error.message}`);
  const meuPerfil = (eu.data ?? {}) as Record<string, unknown>;

  const outro =
    papel === "partner"
      ? await quemPediu(supabase, outroId, nomePadrao)
      : await oParceiro(supabase, outroId, nomePadrao);

  return {
    id: bookingId,
    papel,
    status: texto(linha.status) ?? "pending",
    inicio,
    fim,
    fuso: texto(meuPerfil.timezone) ?? "America/Sao_Paulo",
    eu: { id: userId, nome: texto(meuPerfil.name) ?? "" },
    outro,
  };
}

type Cliente = Awaited<ReturnType<typeof createClient>>;

async function quemPediu(supabase: Cliente, id: string, nomePadrao: string): Promise<PessoaNaSala> {
  const { data, error } = await supabase
    .from("partner_professionals")
    .select("name, photo_url, job_title, org_name")
    .eq("id", id)
    .maybeSingle();
  if (error !== null) throw new Error(`quem pediu: ${error.message}`);
  const p = (data ?? {}) as Record<string, unknown>;
  return {
    id,
    nome: texto(p.name) ?? nomePadrao,
    foto: texto(p.photo_url),
    linha: [texto(p.job_title), texto(p.org_name)].filter(Boolean).join(" · ") || null,
  };
}

/** Parceiro pausado depois de marcar não tem perfil legível: aparece o termo, não um vazio. */
async function oParceiro(supabase: Cliente, id: string, nomePadrao: string): Promise<PessoaNaSala> {
  const perfil = await supabase.from("profiles").select("name, photo_url").eq("id", id).maybeSingle();
  if (perfil.error !== null) throw new Error(`perfil do outro lado: ${perfil.error.message}`);
  const parceiro = await supabase.from("partners").select("headline").eq("id", id).maybeSingle();
  if (parceiro.error !== null) throw new Error(`chamada: ${parceiro.error.message}`);
  const p = (perfil.data ?? {}) as Record<string, unknown>;
  return {
    id,
    nome: texto(p.name) ?? nomePadrao,
    foto: texto(p.photo_url),
    linha: texto((parceiro.data as Record<string, unknown> | null)?.headline),
  };
}

export type PresenteRecebido = { recebido: boolean; saldo: number | null };

/**
 * O Profissional ganhou presente nesta sessão? Pelo próprio extrato, com a RLS
 * dele — a mesma leitura de `/fichas` —, e o saldo junto para a carteira da sala
 * subir no mesmo instante em que o aviso aparece.
 */
export async function presenteRecebido(bookingId: string, userId: string): Promise<PresenteRecebido> {
  const supabase = await createClient();
  const lancamento = await supabase
    .from("wallet_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("idempotency_key", chavePresente(bookingId))
    .maybeSingle();
  if (lancamento.error !== null) throw new Error(`presente: ${lancamento.error.message}`);
  const carteira = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (carteira.error !== null) throw new Error(`carteira: ${carteira.error.message}`);
  const saldo = (carteira.data as Record<string, unknown> | null)?.balance;
  return {
    recebido: lancamento.data !== null,
    saldo: typeof saldo === "number" ? saldo : null,
  };
}
