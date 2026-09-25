import "server-only";

import { and, asc, eq, isNull, sql as raw } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgWallets, orgs, partners, profiles, wallets } from "@/lib/db/schema";
import type { DadosDoParceiro } from "@/lib/pessoas/edicao";
import type { EventoDeAtividade } from "./atividade";
import type { Colaborador, ParceiroNaLista } from "./tipos";

export type { Colaborador, ParceiroNaLista } from "./tipos";

/**
 * As leituras do painel da operadora.
 *
 * Vão por Drizzle, que conecta como `postgres` e portanto fora da RLS — a
 * mesma advertência do `service_role`: o escopo é conferido à mão. Aqui o
 * escopo é "tudo", porque quem abre estas telas é `admin` (conferido por
 * `requireRole()` no layout e de novo em cada ação), e a operadora vê a
 * plataforma inteira por definição.
 *
 * A utilização sai da view `org_usage` e não de uma soma escrita aqui: a view
 * já é o contrato de como se mede utilização, e ter duas fórmulas para o
 * indicador que sustenta a renovação é como elas divergem.
 */

export type ResumoDaPlataforma = {
  empresasAtivas: number;
  fichasContratadas: number;
  fichasEmContrato: number;
  fichasAlocadas: number;
  fichasUsadas: number;
  parceirosAtivos: number;
  profissionais: number;
};

export async function resumoDaPlataforma(): Promise<ResumoDaPlataforma> {
  const db = getDb();

  const [linha] = await db.execute<{
    empresas_ativas: number;
    fichas_contratadas: number;
    fichas_em_contrato: number;
    fichas_alocadas: number;
    fichas_usadas: number;
    parceiros_ativos: number;
    profissionais: number;
  }>(raw`
    select
      (select count(*) from orgs where active)::int                       as empresas_ativas,
      (select coalesce(sum(contracted_fichas), 0) from orgs)::int         as fichas_contratadas,
      (select coalesce(sum(balance), 0) from org_wallets)::int            as fichas_em_contrato,
      (select coalesce(sum(fichas_allocated), 0) from org_usage)::int     as fichas_alocadas,
      (select coalesce(sum(fichas_spent), 0) from org_usage)::int         as fichas_usadas,
      (select count(*) from partners where status = 'active')::int        as parceiros_ativos,
      (select count(*) from profiles
        where role = 'professional' and deleted_at is null)::int          as profissionais`);

  return {
    empresasAtivas: linha.empresas_ativas,
    fichasContratadas: linha.fichas_contratadas,
    fichasEmContrato: linha.fichas_em_contrato,
    fichasAlocadas: linha.fichas_alocadas,
    fichasUsadas: linha.fichas_usadas,
    parceirosAtivos: linha.parceiros_ativos,
    profissionais: linha.profissionais,
  };
}

export type UtilizacaoDaEmpresa = {
  orgId: string;
  nome: string;
  alocadas: number;
  usadas: number;
  /** Null quando nada foi alocado: 0 ÷ 0 não é 0% de utilização, é sem dado. */
  taxa: number | null;
};

/**
 * Utilização acumulada por empresa. `org_usage` é por mês; aqui as linhas são
 * somadas, porque a pergunta do painel é sobre o contrato, não sobre setembro.
 */
export async function utilizacaoPorEmpresa(): Promise<UtilizacaoDaEmpresa[]> {
  const linhas = await getDb().execute<{
    org_id: string;
    nome: string;
    alocadas: number;
    usadas: number;
  }>(raw`
    select o.id                                       as org_id,
           o.name                                     as nome,
           coalesce(sum(u.fichas_allocated), 0)::int  as alocadas,
           coalesce(sum(u.fichas_spent), 0)::int      as usadas
      from orgs o
      left join org_usage u on u.org_id = o.id
     where o.active
     group by o.id, o.name
     order by o.name`);

  return linhas.map((linha) => ({
    orgId: linha.org_id,
    nome: linha.nome,
    alocadas: linha.alocadas,
    usadas: linha.usadas,
    taxa: linha.alocadas === 0 ? null : Math.round((linha.usadas / linha.alocadas) * 100),
  }));
}

export type EmpresaNaLista = {
  id: string;
  nome: string;
  cnpj: string | null;
  ativa: boolean;
  contratadas: number;
  saldo: number;
  colaboradores: number;
};

export async function listarEmpresas(): Promise<EmpresaNaLista[]> {
  const linhas = await getDb().execute<{
    id: string;
    nome: string;
    cnpj: string | null;
    ativa: boolean;
    contratadas: number;
    saldo: number;
    colaboradores: number;
  }>(raw`
    select o.id,
           o.name                          as nome,
           o.cnpj,
           o.active                        as ativa,
           o.contracted_fichas             as contratadas,
           coalesce(w.balance, 0)          as saldo,
           (select count(*) from profiles p
             where p.org_id = o.id
               and p.role = 'professional'
               and p.deleted_at is null)::int as colaboradores
      from orgs o
      left join org_wallets w on w.org_id = o.id
     order by o.active desc, o.name`);

  return linhas.map((linha) => ({ ...linha }));
}

export type Empresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  ativa: boolean;
  contratadas: number;
  saldo: number;
  inicio: string | null;
  fim: string | null;
};

export async function buscarEmpresa(orgId: string): Promise<Empresa | null> {
  const [linha] = await getDb()
    .select({
      id: orgs.id,
      nome: orgs.name,
      cnpj: orgs.cnpj,
      ativa: orgs.active,
      contratadas: orgs.contractedFichas,
      saldo: orgWallets.balance,
      inicio: orgs.contractStart,
      fim: orgs.contractEnd,
    })
    .from(orgs)
    .leftJoin(orgWallets, eq(orgWallets.orgId, orgs.id))
    .where(eq(orgs.id, orgId))
    .limit(1);

  if (!linha) return null;
  return { ...linha, saldo: linha.saldo ?? 0 };
}


export async function listarColaboradores(orgId: string): Promise<Colaborador[]> {
  return getDb()
    .select({
      id: profiles.id,
      nome: profiles.name,
      email: profiles.email,
      cargo: profiles.jobTitle,
      ativo: profiles.active,
      saldo: wallets.balance,
      ultimoUso: wallets.lastUsedAt,
    })
    .from(profiles)
    .innerJoin(wallets, eq(wallets.userId, profiles.id))
    .where(
      and(
        eq(profiles.orgId, orgId),
        eq(profiles.role, "professional"),
        isNull(profiles.deletedAt),
      ),
    )
    .orderBy(asc(profiles.name));
}

export type LancamentoDoContrato = {
  id: string;
  tipo: string;
  quantidade: number;
  saldoDepois: number;
  motivo: string | null;
  quando: Date;
  /** Nome de quem lançou, ou null quando foi o trabalho agendado. */
  autor: string | null;
  destino: string | null;
};

export async function listarLancamentosDoContrato(
  orgId: string,
  limite = 12,
): Promise<LancamentoDoContrato[]> {
  const linhas = await getDb().execute<{
    id: string;
    tipo: string;
    quantidade: number;
    saldo_depois: number;
    motivo: string | null;
    quando: string;
    autor: string | null;
    destino: string | null;
  }>(raw`
    select l.id,
           l.type::text          as tipo,
           l.amount              as quantidade,
           l.balance_after       as saldo_depois,
           l.reason              as motivo,
           l.created_at          as quando,
           quem.name             as autor,
           alvo.name             as destino
      from org_ledger l
      left join profiles quem on quem.id = l.by_user_id
      left join profiles alvo on alvo.id = l.to_user_id
     where l.org_id = ${orgId}
     order by l.created_at desc
     limit ${limite}`);

  return linhas.map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    quantidade: linha.quantidade,
    saldoDepois: linha.saldo_depois,
    motivo: linha.motivo,
    quando: new Date(linha.quando),
    autor: linha.autor,
    destino: linha.destino,
  }));
}


export async function listarParceiros(): Promise<ParceiroNaLista[]> {
  const linhas = await getDb()
    .select({
      id: partners.id,
      nome: profiles.name,
      email: profiles.email,
      headline: partners.headline,
      status: partners.status,
      engajamento: partners.engagement,
      areas: partners.areas,
      sessoes: partners.sessionCount,
      maxPorSemana: partners.maxPerWeek,
    })
    .from(partners)
    .innerJoin(profiles, eq(profiles.id, partners.id))
    .orderBy(asc(profiles.name));

  return linhas;
}

export type AcaoRegistrada = EventoDeAtividade & {
  id: string;
  quando: Date;
};

/**
 * O histórico de decisões, já com os nomes que a frase precisa.
 *
 * `audit_logs` guarda ids; a tela fala de pessoas. O alvo sai de
 * `entity_id` quando ele é de alguém em `profiles` (criar, editar, alocar,
 * desativar), e a empresa de `org_id`. O `after` vai junto porque é dele que
 * sai "2 fichas" — a quantidade não mora em coluna nenhuma.
 *
 * Invariante 12 vista do lado de quem lê.
 */
export async function listarAtividade(
  filtro: { acao?: string | null; entidadeId?: string | null; limite?: number } = {},
): Promise<AcaoRegistrada[]> {
  const acao = filtro.acao ?? null;
  const entidadeId = filtro.entidadeId ?? null;
  const limite = filtro.limite ?? 8;

  const linhas = await getDb().execute<{
    id: string;
    acao: string;
    quando: string;
    antes: unknown;
    depois: unknown;
    autor: string | null;
    alvo: string | null;
    empresa: string | null;
  }>(raw`
    select a.id,
           a.action      as acao,
           a.created_at  as quando,
           a.before      as antes,
           a.after       as depois,
           quem.name     as autor,
           alvo.name     as alvo,
           o.name        as empresa
      from audit_logs a
      left join profiles quem on quem.id = a.actor_id
      left join profiles alvo on alvo.id = a.entity_id
      left join orgs o        on o.id = a.org_id
     where (${acao}::text is null or a.action = ${acao}::text)
       and (${entidadeId}::uuid is null or a.entity_id = ${entidadeId}::uuid)
     order by a.created_at desc
     limit ${limite}`);

  return linhas.map((linha) => ({
    id: linha.id,
    acao: linha.acao,
    quando: new Date(linha.quando),
    antes: linha.antes,
    depois: linha.depois,
    autor: linha.autor,
    alvo: linha.alvo,
    empresa: linha.empresa,
  }));
}

/** As últimas decisões, para o card do painel. */
export async function listarAcoesRecentes(limite = 8): Promise<AcaoRegistrada[]> {
  return listarAtividade({ limite });
}

export type ParceiroEmDetalhe = DadosDoParceiro & {
  id: string;
  status: string;
  ativo: boolean;
  sessoes: number;
  desde: Date;
};

export async function buscarParceiro(id: string): Promise<ParceiroEmDetalhe | null> {
  const [linha] = await getDb()
    .select({
      id: partners.id,
      nome: profiles.name,
      email: profiles.email,
      fuso: profiles.timezone,
      ativo: profiles.active,
      desde: profiles.createdAt,
      headline: partners.headline,
      bio: partners.bio,
      areas: partners.areas,
      habilidades: partners.skills,
      senioridade: partners.seniority,
      engajamento: partners.engagement,
      maxPorSemana: partners.maxPerWeek,
      bufferMin: partners.bufferMin,
      confirmaSozinho: partners.autoConfirm,
      status: partners.status,
      sessoes: partners.sessionCount,
    })
    .from(partners)
    .innerJoin(profiles, eq(profiles.id, partners.id))
    .where(eq(partners.id, id))
    .limit(1);

  return linha ?? null;
}

export type ProfissionalEmDetalhe = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  area: string | null;
  ativo: boolean;
  desde: Date;
  saldo: number;
  ultimoUso: Date | null;
};

/** Conferindo a empresa: o `orgId` vem da URL e não é prova de nada sozinho. */
export async function buscarProfissional(
  orgId: string,
  id: string,
): Promise<ProfissionalEmDetalhe | null> {
  const [linha] = await getDb()
    .select({
      id: profiles.id,
      nome: profiles.name,
      email: profiles.email,
      cargo: profiles.jobTitle,
      area: profiles.area,
      ativo: profiles.active,
      desde: profiles.createdAt,
      saldo: wallets.balance,
      ultimoUso: wallets.lastUsedAt,
    })
    .from(profiles)
    .innerJoin(wallets, eq(wallets.userId, profiles.id))
    .where(
      and(
        eq(profiles.id, id),
        eq(profiles.orgId, orgId),
        eq(profiles.role, "professional"),
        isNull(profiles.deletedAt),
      ),
    )
    .limit(1);

  return linha ?? null;
}

/** Só para a trilha de migalhas e o título — evita carregar a empresa inteira. */
export async function nomeDaEmpresa(orgId: string): Promise<string | null> {
  const [linha] = await getDb()
    .select({ nome: orgs.name })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  return linha?.nome ?? null;
}

/** Usada pela ação de alocação para conferir que a pessoa é da empresa. */
export async function ehColaboradorDaEmpresa(orgId: string, userId: string): Promise<boolean> {
  const [linha] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(eq(profiles.id, userId), eq(profiles.orgId, orgId), eq(profiles.role, "professional")),
    )
    .limit(1);
  return linha !== undefined;
}
