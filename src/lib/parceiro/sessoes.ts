import "server-only";

import type { SessaoNaAgenda } from "@/lib/bookings/agenda";
import { createClient } from "@/lib/supabase/server";

/**
 * As sessões do Parceiro, lidas **pela sessão dele**, como o resto de
 * `lib/parceiro`.
 *
 * `bookings` pela policy de participante; quem pediu, pela view
 * `partner_professionals` — nome, foto, cargo e empresa de quem marcou com ele,
 * e nada além disso. Se a view ou a policy estiverem erradas, a tela mostra o
 * defeito na hora: pedido sem nome, ou nome de quem não devia.
 */

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function instante(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function carregarSessoesDoParceiro(
  partnerId: string,
  nomePadrao: string,
): Promise<SessaoNaAgenda[]> {
  const supabase = await createClient();
  const { data: sessoes, error } = await supabase
    .from("bookings")
    .select("id, professional_id, start_at, end_at, status, created_at, cancelled_by")
    .eq("partner_id", partnerId)
    .order("start_at", { ascending: false })
    .limit(200);
  if (error !== null) throw new Error(`sessões: ${error.message}`);

  const linhas = (sessoes ?? []).map((l) => l as Record<string, unknown>);
  const ids = [
    ...new Set(linhas.map((l) => l.professional_id).filter((v): v is string => typeof v === "string")),
  ];

  const pessoas = new Map<string, SessaoNaAgenda["outro"]>();
  if (ids.length > 0) {
    const perfis = await supabase
      .from("partner_professionals")
      .select("id, name, photo_url, job_title, org_name")
      .in("id", ids);
    if (perfis.error !== null) throw new Error(`quem pediu: ${perfis.error.message}`);
    for (const p of (perfis.data ?? []).map((x) => x as Record<string, unknown>)) {
      if (typeof p.id !== "string") continue;
      pessoas.set(p.id, {
        id: p.id,
        nome: texto(p.name) ?? nomePadrao,
        foto: texto(p.photo_url),
        cargo: texto(p.job_title),
        empresa: texto(p.org_name),
      });
    }
  }

  return linhas.flatMap((l) => {
    const inicio = instante(l.start_at);
    const fim = instante(l.end_at);
    if (typeof l.id !== "string" || typeof l.professional_id !== "string" || !inicio || !fim) {
      return [];
    }
    return [
      {
        id: l.id,
        inicio,
        fim,
        status: texto(l.status) ?? "pending",
        criadaEm: instante(l.created_at) ?? inicio,
        recusadaPeloParceiro: l.cancelled_by === partnerId,
        outro: pessoas.get(l.professional_id) ?? {
          id: l.professional_id,
          nome: nomePadrao,
          foto: null,
          cargo: null,
          empresa: null,
        },
      },
    ];
  });
}
