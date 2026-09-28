import "server-only";

import { createClient } from "@/lib/supabase/server";
import { rotuloDoLancamento } from "@/lib/ledger/rotulos";
import type { NomeIcone } from "@/components/ui/icones";
import type { SessaoNaAgenda } from "@/lib/bookings/agenda";

/**
 * A carteira do Profissional, lida **pelo cliente da sessão dele**.
 *
 * Nem Drizzle nem `service_role`. A Etapa 3 deu a `wallets` e a `wallet_ledger`
 * policy de `select` do próprio `user_id` e **nenhuma** de escrita (invariante
 * 4), então ler por aqui é ler exatamente o que a policy permite: se ela
 * estivesse frouxa, a tela mostraria carteira alheia e o defeito apareceria na
 * hora, em vez de dormir até alguém procurar.
 *
 * De quebra evita o travamento: estas consultas vão por HTTP ao PostgREST, não
 * pela conexão Drizzle de `max: 1` que não tolera consulta concorrente. É o
 * mesmo motivo documentado em `lib/parceiro/dados.ts`, e é o que permite o saldo
 * ser lido no layout enquanto a página faz o dela.
 *
 * O preço é que a resposta do supabase-js não é tipada pelo esquema, então cada
 * linha é validada aqui antes de virar tipo da aplicação.
 */

export type Carteira = {
  saldo: number;
  /** Último lançamento negativo — o que alimenta o `nudge-idle`. */
  ultimoUso: Date | null;
  ultimaEntrada: Date | null;
};

export type LancamentoDaCarteira = {
  id: string;
  tipo: string;
  rotulo: string;
  icone: NomeIcone;
  /** Positivo entrou, negativo saiu. */
  quantidade: number;
  saldoDepois: number;
  motivo: string | null;
  quando: Date;
};

function inteiro(valor: unknown, padrao: number): number {
  return typeof valor === "number" && Number.isInteger(valor) ? valor : padrao;
}

function data(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

/**
 * Devolve `null` quando não há carteira — e isso não é erro.
 *
 * O Profissional é criado com carteira, mas a conta pode existir sem ela num
 * banco em que alguém mexeu à mão. A tela diz "fale com o RH" em vez de estourar.
 */
export async function carregarCarteira(userId: string): Promise<Carteira | null> {
  const supabase = await createClient();
  const { data: linha, error } = await supabase
    .from("wallets")
    .select("balance, last_used_at, last_entry_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) throw new Error(`carteira: ${error.message}`);
  if (linha === null) return null;

  const w = linha as Record<string, unknown>;
  return {
    saldo: inteiro(w.balance, 0),
    ultimoUso: data(w.last_used_at),
    ultimaEntrada: data(w.last_entry_at),
  };
}

/**
 * O extrato, do mais novo para o mais velho.
 *
 * Sem o nome de quem lançou, de propósito: quem aloca é a operadora ou o RH, e a
 * policy de `profiles` não deixa o Profissional ler o perfil de quem não é da
 * empresa dele nem Parceiro ativo (invariante 9). Tentar mostrar o nome daria
 * uma coluna vazia e a impressão de defeito. O que importa aqui é o movimento da
 * ficha; de quem partiu é assunto do livro-caixa da empresa.
 */
export async function carregarExtrato(
  userId: string,
  limite = 20,
): Promise<LancamentoDaCarteira[]> {
  const supabase = await createClient();
  const { data: linhas, error } = await supabase
    .from("wallet_ledger")
    .select("id, type, amount, balance_after, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error !== null) throw new Error(`extrato: ${error.message}`);

  return (linhas ?? [])
    .map((linha) => linha as Record<string, unknown>)
    .filter((l) => typeof l.id === "string" && typeof l.type === "string")
    .map((l) => {
      const { rotulo, icone } = rotuloDoLancamento(l.type as string);
      return {
        id: l.id as string,
        tipo: l.type as string,
        rotulo,
        icone,
        quantidade: inteiro(l.amount, 0),
        saldoDepois: inteiro(l.balance_after, 0),
        motivo: texto(l.reason),
        quando: data(l.created_at) ?? new Date(0),
      };
    });
}

// ---------------------------------------------------------------- P4

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
}

/** Nome e fuso do próprio Profissional — a borda de UI converte para o fuso dele. */
export async function carregarEu(userId: string): Promise<{ nome: string; fuso: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("name, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error !== null) throw new Error(`perfil: ${error.message}`);
  const linha = (data ?? {}) as Record<string, unknown>;
  return { nome: texto(linha.name) ?? "", fuso: texto(linha.timezone) ?? "America/Sao_Paulo" };
}

export async function carregarFuso(userId: string): Promise<string> {
  return (await carregarEu(userId)).fuso;
}

export type ParceiroNaBusca = {
  id: string;
  nome: string;
  foto: string | null;
  chamada: string | null;
  bio: string | null;
  areas: string[];
  habilidades: string[];
  senioridade: string | null;
  /** `auto_confirm`: a reserva já nasce confirmada, sem esperar resposta. */
  confirmaSozinho: boolean;
};

/**
 * Os Parceiros ativos, lidos pela RLS.
 *
 * `partners` ativos são abertos a qualquer autenticado (invariante 9: Parceiro é
 * da plataforma), e a Etapa 3 abriu o perfil de Parceiro ativo pelo mesmo motivo
 * — é o que traz o nome junto. O filtro de `status` é redundante com a policy
 * e fica mesmo assim: o próprio Parceiro pausado, se um dia vier aqui, veria a si
 * mesmo pela outra metade da policy.
 */
export async function listarParceirosAtivos(id?: string): Promise<ParceiroNaBusca[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("partners")
    .select(
      "id, headline, bio, areas, skills, seniority, auto_confirm, profiles!inner(name, photo_url, deleted_at)",
    )
    .eq("status", "active")
    .is("profiles.deleted_at", null);
  if (id !== undefined) consulta = consulta.eq("id", id);

  const { data, error } = await consulta;
  if (error !== null) throw new Error(`Parceiros: ${error.message}`);

  return (data ?? [])
    .map((linha) => linha as Record<string, unknown>)
    .filter((l) => typeof l.id === "string")
    .map((l) => {
      const perfil = (l.profiles ?? {}) as Record<string, unknown>;
      return {
        id: l.id as string,
        nome: texto(perfil.name) ?? "",
        foto: texto(perfil.photo_url),
        chamada: texto(l.headline),
        bio: texto(l.bio),
        areas: listaDeTexto(l.areas),
        habilidades: listaDeTexto(l.skills),
        senioridade: texto(l.seniority),
        confirmaSozinho: l.auto_confirm === true,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function carregarParceiroAtivo(id: string): Promise<ParceiroNaBusca | null> {
  const [parceiro] = await listarParceirosAtivos(id);
  return parceiro ?? null;
}

/**
 * As sessões do Profissional, pela RLS de `bookings` (dono da sessão).
 *
 * O nome do Parceiro vem numa segunda leitura, de `profiles`: a policy mostra o
 * perfil de Parceiro **ativo**. Sessão com Parceiro que pausou depois aparece
 * sem nome — e a tela diz o termo em vez de deixar vazio.
 */
export async function carregarAgendaDoProfissional(
  userId: string,
  nomePadrao: string,
): Promise<SessaoNaAgenda[]> {
  const supabase = await createClient();
  const { data: sessoes, error } = await supabase
    .from("bookings")
    .select("id, partner_id, start_at, end_at, status, created_at, cancelled_by")
    .eq("professional_id", userId)
    .order("start_at", { ascending: false })
    .limit(100);
  if (error !== null) throw new Error(`agenda: ${error.message}`);

  const linhas = (sessoes ?? []).map((l) => l as Record<string, unknown>);
  const ids = [...new Set(linhas.map((l) => l.partner_id).filter((v): v is string => typeof v === "string"))];

  const nomes = new Map<string, { nome: string; foto: string | null }>();
  if (ids.length > 0) {
    const perfis = await supabase.from("profiles").select("id, name, photo_url").in("id", ids);
    if (perfis.error !== null) throw new Error(`Parceiros da agenda: ${perfis.error.message}`);
    for (const p of (perfis.data ?? []).map((x) => x as Record<string, unknown>)) {
      if (typeof p.id === "string") {
        nomes.set(p.id, { nome: texto(p.name) ?? nomePadrao, foto: texto(p.photo_url) });
      }
    }
  }

  return linhas.flatMap((l) => {
    const inicio = data(l.start_at);
    const fim = data(l.end_at);
    if (typeof l.id !== "string" || typeof l.partner_id !== "string" || !inicio || !fim) return [];
    const pessoa = nomes.get(l.partner_id);
    return [
      {
        id: l.id,
        inicio,
        fim,
        status: texto(l.status) ?? "pending",
        criadaEm: data(l.created_at) ?? inicio,
        recusadaPeloParceiro: l.cancelled_by === l.partner_id,
        outro: {
          id: l.partner_id,
          nome: pessoa?.nome ?? nomePadrao,
          foto: pessoa?.foto ?? null,
          cargo: null,
          empresa: null,
        },
      },
    ];
  });
}
