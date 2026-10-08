import "server-only";

import { and, asc, eq, isNull, sql as raw } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orgWallets, orgs, partners, profiles, wallets } from "@/lib/db/schema";
import { parseBranding } from "@/lib/config/app-config";
import { marcaDoBranding, type MarcaDaEmpresa } from "@/lib/marca/operacoes";
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
  contasPessoais: number;
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
    contas_pessoais: number;
    fichas_contratadas: number;
    fichas_em_contrato: number;
    fichas_alocadas: number;
    fichas_usadas: number;
    parceiros_ativos: number;
    profissionais: number;
  }>(raw`
    select
      (select count(*) from orgs where active and kind = 'empresa')::int  as empresas_ativas,
      (select count(*) from orgs where kind = 'individual')::int          as contas_pessoais,
      -- Contrato é de empresa. O que a conta pessoal comprou fica de fora: somado
      -- aqui, inflaria "fichas contratadas" com pacote de pessoa física.
      (select coalesce(sum(contracted_fichas), 0) from orgs
        where kind = 'empresa')::int                                      as fichas_contratadas,
      (select coalesce(sum(w.balance), 0) from org_wallets w
         join orgs o on o.id = w.org_id where o.kind = 'empresa')::int    as fichas_em_contrato,
      (select coalesce(sum(fichas_allocated), 0) from org_usage)::int     as fichas_alocadas,
      (select coalesce(sum(fichas_used), 0) from org_usage)::int          as fichas_usadas,
      (select count(*) from partners where status = 'active')::int        as parceiros_ativos,
      (select count(*) from profiles p join orgs o on o.id = p.org_id
        where p.role = 'professional' and p.deleted_at is null
          and o.kind = 'empresa')::int                                    as profissionais`);

  return {
    empresasAtivas: linha.empresas_ativas,
    contasPessoais: linha.contas_pessoais,
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
  /** Alocadas mais as que chegaram sem sair do contrato (presente, compensação). */
  recebidas: number;
  /** Gastas em sessão menos as que voltaram por estorno. */
  usadas: number;
  /** Null quando nada foi recebido: 0 ÷ 0 não é 0% de utilização, é sem dado. */
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
    recebidas: number;
    usadas: number;
  }>(raw`
    select o.id                                                          as org_id,
           o.name                                                        as nome,
           coalesce(sum(u.fichas_allocated + u.fichas_extra), 0)::int    as recebidas,
           coalesce(sum(u.fichas_used), 0)::int                          as usadas
      from orgs o
      left join org_usage u on u.org_id = o.id
     where o.active and o.kind = 'empresa'
     group by o.id, o.name
     order by o.name`);

  return linhas.map((linha) => ({
    orgId: linha.org_id,
    nome: linha.nome,
    recebidas: linha.recebidas,
    usadas: linha.usadas,
    taxa: linha.recebidas === 0 ? null : Math.round((linha.usadas / linha.recebidas) * 100),
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

export type MarcaNaLista = {
  id: string;
  nome: string;
  ativa: boolean;
  marca: MarcaDaEmpresa;
};

/** A marca de cada empresa, para a tela de personalização. Conta pessoal usa a da plataforma. */
export async function listarMarcas(): Promise<MarcaNaLista[]> {
  const linhas = await getDb()
    .select({ id: orgs.id, nome: orgs.name, ativa: orgs.active, branding: orgs.branding })
    .from(orgs)
    .where(eq(orgs.kind, "empresa"))
    .orderBy(raw`${orgs.active} desc`, asc(orgs.name));

  return linhas.map(({ branding, ...linha }) => ({
    ...linha,
    marca: marcaDoBranding(parseBranding(branding)),
  }));
}

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
     where o.kind = 'empresa'
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
  /**
   * A marca como está gravada, não o tema resolvido — é o que o formulário
   * edita. Lida aqui, e não por `loadOrgBranding`, porque aquele degrada para
   * vazio com o banco fora do ar, e salvar em cima do vazio apagaria a marca.
   */
  marca: MarcaDaEmpresa;
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
      branding: orgs.branding,
    })
    .from(orgs)
    .leftJoin(orgWallets, eq(orgWallets.orgId, orgs.id))
    // A tela de empresa não abre conta pessoal: ela não tem contrato nem RH, e
    // o formulário de contrato lá moveria ficha por um caminho que ela não tem.
    .where(and(eq(orgs.id, orgId), eq(orgs.kind, "empresa")))
    .limit(1);

  if (!linha) return null;
  const { branding, ...empresa } = linha;
  return { ...empresa, saldo: linha.saldo ?? 0, marca: marcaDoBranding(parseBranding(branding)) };
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
           -- Conta pessoal leva o nome da pessoa; mostrá-lo como empresa repetiria.
           case when o.kind = 'empresa' then o.name end as empresa
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
    .where(and(eq(orgs.id, orgId), eq(orgs.kind, "empresa")))
    .limit(1);
  return linha?.nome ?? null;
}

/** Usada pela ação de alocação para conferir que a pessoa é da empresa. */
export async function ehColaboradorDaEmpresa(orgId: string, userId: string): Promise<boolean> {
  const [linha] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .innerJoin(orgs, eq(orgs.id, profiles.orgId))
    .where(
      and(
        eq(profiles.id, userId),
        eq(profiles.orgId, orgId),
        eq(profiles.role, "professional"),
        eq(orgs.kind, "empresa"),
      ),
    )
    .limit(1);
  return linha !== undefined;
}

export type ContaPessoalNaLista = {
  id: string;
  orgId: string;
  nome: string;
  email: string;
  ativo: boolean;
  saldo: number;
  /** Total comprado desde sempre — `contracted_fichas` da `org` individual. */
  compradas: number;
  ultimaCompra: Date | null;
  desde: Date;
};

/**
 * As contas pessoais, separadas das empresas: são a mesma tabela, mas a
 * operadora lê as duas de jeitos diferentes — empresa por contrato, conta
 * pessoal por pessoa.
 */
export async function listarContasPessoais(): Promise<ContaPessoalNaLista[]> {
  const linhas = await getDb().execute<{
    id: string;
    org_id: string;
    nome: string;
    email: string;
    ativo: boolean;
    saldo: number;
    compradas: number;
    ultima_compra: string | null;
    desde: string;
  }>(raw`
    select p.id,
           o.id                   as org_id,
           p.name                 as nome,
           p.email,
           p.active               as ativo,
           coalesce(w.balance, 0) as saldo,
           o.contracted_fichas    as compradas,
           (select max(pg.paid_at) from payments pg
             where pg.user_id = p.id and pg.status = 'confirmed') as ultima_compra,
           p.created_at           as desde
      from orgs o
      join profiles p on p.org_id = o.id
      left join wallets w on w.user_id = p.id
     where o.kind = 'individual'
       and p.deleted_at is null
     order by p.active desc, p.name`);

  return linhas.map((l) => ({
    id: l.id,
    orgId: l.org_id,
    nome: l.nome,
    email: l.email,
    ativo: l.ativo,
    saldo: l.saldo,
    compradas: l.compradas,
    ultimaCompra: l.ultima_compra === null ? null : new Date(l.ultima_compra),
    desde: new Date(l.desde),
  }));
}

/**
 * A conta pessoal de uma pessoa: o `orgId` sai do perfil, não da URL — a rota é
 * pela pessoa. Null quando ela não existe ou é colaboradora de empresa.
 */
export async function contaPessoalDe(
  userId: string,
): Promise<{ orgId: string; telefone: string | null } | null> {
  const [linha] = await getDb()
    .select({ orgId: orgs.id, telefone: profiles.phone })
    .from(profiles)
    .innerJoin(orgs, eq(orgs.id, profiles.orgId))
    .where(
      and(
        eq(profiles.id, userId),
        eq(profiles.role, "professional"),
        eq(orgs.kind, "individual"),
        isNull(profiles.deletedAt),
      ),
    )
    .limit(1);
  return linha ?? null;
}

export type PagamentoNaLista = {
  id: string;
  pacote: string;
  fichas: number;
  valorCentavos: number;
  meio: string;
  status: string;
  referencia: string | null;
  pagoEm: Date | null;
  criadoEm: Date;
};

export async function listarPagamentos(userId: string): Promise<PagamentoNaLista[]> {
  const linhas = await getDb().execute<{
    id: string;
    pacote: string;
    fichas: number;
    valor: number;
    meio: string;
    status: string;
    referencia: string | null;
    pago_em: string | null;
    criado_em: string;
  }>(raw`
    select id, package_id as pacote, fichas, amount_cents as valor, provider as meio, status,
           reference as referencia, paid_at as pago_em, created_at as criado_em
      from payments
     where user_id = ${userId}
     order by created_at desc`);

  return linhas.map((l) => ({
    id: l.id,
    pacote: l.pacote,
    fichas: l.fichas,
    valorCentavos: l.valor,
    meio: l.meio,
    status: l.status,
    referencia: l.referencia,
    pagoEm: l.pago_em === null ? null : new Date(l.pago_em),
    criadoEm: new Date(l.criado_em),
  }));
}
