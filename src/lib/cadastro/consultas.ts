import "server-only";

import { getSql } from "@/lib/db";

/**
 * As leituras da fila de cadastros (`/admin/cadastros`).
 *
 * Pela conexão de servidor, como o resto do painel da operadora: a policy de
 * `individual_signups` abre a leitura à equipe, mas a confirmação do e-mail
 * mora em `auth.users`, que a sessão não lê. Quem abre a tela é `admin` ou
 * `moderator`, conferido no layout e de novo na página.
 */

export type PedidoNaFila = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  linkedin: string | null;
  objetivo: string | null;
  pedidoEm: Date;
  /** Sem confirmação, a aprovação é recusada — o endereço pode nem ser de quem preencheu. */
  emailConfirmado: boolean;
  temLogin: boolean;
};

export type PedidoDecidido = {
  id: string;
  nome: string;
  email: string | null;
  aprovado: boolean;
  decididoEm: Date;
  decididoPor: string | null;
  motivo: string | null;
  anonimizado: boolean;
};

export async function listarPendentes(): Promise<PedidoNaFila[]> {
  const linhas = await getSql()<
    {
      id: string;
      nome: string;
      email: string;
      telefone: string | null;
      cargo: string | null;
      area: string | null;
      linkedin: string | null;
      objetivo: string | null;
      pedido_em: string;
      confirmado: boolean;
      tem_login: boolean;
    }[]
  >`
    select s.id, s.name as nome, s.email, s.phone as telefone, s.job_title as cargo, s.area,
           s.linkedin, s.goal as objetivo, s.created_at as pedido_em,
           (u.email_confirmed_at is not null) as confirmado,
           (u.id is not null)                  as tem_login
      from individual_signups s
      left join auth.users u on u.id = s.user_id
     where s.status = 'pending'
     order by s.created_at`;

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    cargo: l.cargo,
    area: l.area,
    linkedin: l.linkedin,
    objetivo: l.objetivo,
    pedidoEm: new Date(l.pedido_em),
    emailConfirmado: l.confirmado,
    temLogin: l.tem_login,
  }));
}

/** Os últimos decididos, para a operadora conferir o que fez — não é o arquivo inteiro. */
export async function listarDecididos(limite = 30): Promise<PedidoDecidido[]> {
  const linhas = await getSql()<
    {
      id: string;
      nome: string;
      email: string;
      status: string;
      decidido_em: string;
      decidido_por: string | null;
      motivo: string | null;
      anonimizado: boolean;
    }[]
  >`
    select s.id, s.name as nome, s.email, s.status, s.decided_at as decidido_em,
           p.name as decidido_por, s.reject_reason as motivo,
           (s.anonymized_at is not null) as anonimizado
      from individual_signups s
      left join profiles p on p.id = s.decided_by
     where s.status <> 'pending'
     order by s.decided_at desc nulls last
     limit ${limite}`;

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.anonimizado ? null : l.email,
    aprovado: l.status === "approved",
    decididoEm: new Date(l.decidido_em),
    decididoPor: l.decidido_por,
    motivo: l.motivo,
    anonimizado: l.anonimizado,
  }));
}

/** Quantos esperam decisão — para o painel apontar a fila. */
export async function contarPendentes(): Promise<number> {
  const [linha] = await getSql()<{ n: number }[]>`
    select count(*)::int as n from individual_signups where status = 'pending'`;
  return linha?.n ?? 0;
}
