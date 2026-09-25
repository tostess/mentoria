import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ehDiaDaSemana } from "./horarios";
import type { DiaDaSemana, Excecao, Ocupacao, RegraSemanal } from "@/lib/scheduling";

/**
 * Os dados do próprio Parceiro, lidos **pelo cliente da sessão dele**.
 *
 * Aqui não entra `service_role` nem Drizzle. É o único lugar do produto em que
 * o papel autenticado escreve de verdade — a Etapa 3 deu ao Parceiro policies
 * de `all` em `partner_rules` e `partner_exceptions`, e privilégio de coluna em
 * `partners` e `profiles`. Passar por cima disso com a chave secreta
 * funcionaria e desperdiçaria o desenho: do jeito que está, se a policy estiver
 * errada a tela quebra na hora, em vez de a falha só aparecer quando alguém
 * tentar ler o que não devia.
 *
 * O preço é que a resposta do supabase-js não é tipada pelo esquema, então cada
 * linha é validada aqui antes de virar tipo do motor.
 */

export type PerfilDoParceiro = {
  nome: string;
  email: string;
  fuso: string;
  headline: string | null;
  bio: string | null;
  areas: string[];
  habilidades: string[];
  senioridade: string | null;
  bufferMin: number;
  maxPorSemana: number;
  confirmaSozinho: boolean;
  status: string;
  engajamento: string;
  sessoes: number;
};

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
}

function inteiro(valor: unknown, padrao: number): number {
  return typeof valor === "number" && Number.isInteger(valor) ? valor : padrao;
}

export async function carregarPerfil(userId: string): Promise<PerfilDoParceiro | null> {
  const supabase = await createClient();

  // `Promise.all` é seguro aqui: estas consultas vão por HTTP ao PostgREST, não
  // pela conexão Drizzle de `max: 1` que não tolera consulta concorrente.
  const [perfil, parceiro] = await Promise.all([
    supabase.from("profiles").select("name, email, timezone").eq("id", userId).maybeSingle(),
    supabase
      .from("partners")
      .select(
        "headline, bio, areas, skills, seniority, buffer_min, max_per_week, auto_confirm, status, engagement, session_count",
      )
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (perfil.error !== null) throw new Error(`perfil: ${perfil.error.message}`);
  if (parceiro.error !== null) throw new Error(`parceiro: ${parceiro.error.message}`);
  if (perfil.data === null || parceiro.data === null) return null;

  const p = perfil.data as Record<string, unknown>;
  const q = parceiro.data as Record<string, unknown>;

  return {
    nome: texto(p.name) ?? "",
    email: texto(p.email) ?? "",
    fuso: texto(p.timezone) ?? "America/Sao_Paulo",
    headline: texto(q.headline),
    bio: texto(q.bio),
    areas: listaDeTexto(q.areas),
    habilidades: listaDeTexto(q.skills),
    senioridade: texto(q.seniority),
    bufferMin: inteiro(q.buffer_min, 15),
    maxPorSemana: inteiro(q.max_per_week, 4),
    confirmaSozinho: q.auto_confirm === true,
    status: texto(q.status) ?? "invited",
    engajamento: texto(q.engagement) ?? "voluntario",
    sessoes: inteiro(q.session_count, 0),
  };
}

export async function carregarRegras(userId: string): Promise<RegraSemanal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_rules")
    .select("weekday, start_min, end_min, effective_from, effective_to")
    .eq("partner_id", userId)
    .order("weekday");

  if (error !== null) throw new Error(`regras: ${error.message}`);

  return (data ?? [])
    .map((linha) => linha as Record<string, unknown>)
    .filter((linha) => ehDiaDaSemana(linha.weekday))
    .map((linha) => ({
      diaDaSemana: linha.weekday as DiaDaSemana,
      inicioMin: inteiro(linha.start_min, 0),
      fimMin: inteiro(linha.end_min, 0),
      valeDe: texto(linha.effective_from),
      valeAte: texto(linha.effective_to),
    }));
}

export async function carregarExcecoes(userId: string): Promise<Excecao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_exceptions")
    .select("day, kind, start_min, end_min")
    .eq("partner_id", userId);

  if (error !== null) throw new Error(`exceções: ${error.message}`);

  return (data ?? [])
    .map((linha) => linha as Record<string, unknown>)
    .map((linha) => ({
      dia: texto(linha.day)?.slice(0, 10) ?? "",
      // O banco fala `block`/`extra`; o motor fala `bloqueio`/`extra`.
      tipo: linha.kind === "block" ? ("bloqueio" as const) : ("extra" as const),
      inicioMin: typeof linha.start_min === "number" ? linha.start_min : null,
      fimMin: typeof linha.end_min === "number" ? linha.end_min : null,
    }))
    .filter((excecao) => excecao.dia !== "");
}

/**
 * As sessões que já ocupam a agenda.
 *
 * Só `pending` e `confirmed`: é o mesmo recorte da constraint de exclusão da
 * invariante 7. Sessão cancelada ou expirada não bloqueia horário nenhum, e
 * incluí-la faria a agenda encolher sozinha com o tempo.
 */
export async function carregarOcupacoes(userId: string, desde: Date): Promise<Ocupacao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("start_at, end_at")
    .eq("partner_id", userId)
    .in("status", ["pending", "confirmed"])
    .gte("end_at", desde.toISOString());

  if (error !== null) throw new Error(`sessões: ${error.message}`);

  return (data ?? [])
    .map((linha) => linha as Record<string, unknown>)
    .filter((linha) => typeof linha.start_at === "string" && typeof linha.end_at === "string")
    .map((linha) => ({
      inicio: new Date(linha.start_at as string),
      fim: new Date(linha.end_at as string),
    }));
}
