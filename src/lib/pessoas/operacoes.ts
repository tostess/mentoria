import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import { paraJsonb } from "@/lib/db/jsonb";
import type { Ator } from "@/lib/ledger/operacoes";

/**
 * As linhas que nascem quando o admin cria uma empresa ou uma pessoa.
 *
 * Como em `ledger/operacoes.ts`, recebem a transação em vez de abri-la — é o
 * que permite ao teste chamar a mesma função que a aplicação chama e desfazer
 * tudo no fim. Sem `server-only`: nenhuma delas lê segredo nem conecta.
 *
 * O que **não** está aqui é a criação da identidade em `auth.users`: é chamada
 * HTTP ao servidor de auth e não cabe numa transação de banco. Ela mora em
 * `criar.ts`, junto da compensação que a desfaz.
 */

export const ENGAJAMENTOS = ["voluntario", "parceria", "remunerado"] as const;
export type Engajamento = (typeof ENGAJAMENTOS)[number];

export type NovaEmpresa = {
  nome: string;
  cnpj: string | null;
  inicio: string | null;
  fim: string | null;
  accent: string | null;
  ator: Ator;
};

/**
 * A empresa nasce com contrato zero e carteira criada.
 *
 * A carteira é criada aqui e não por trigger porque o trigger de saldo só sabe
 * somar: `apply_org_entry` levanta exceção quando a carteira não existe. Sem
 * esta linha, a primeira compra da empresa falharia com "carteira de empresa
 * inexistente" — erro certo, momento errado.
 */
export async function empresaNaTransacao(
  tx: postgres.TransactionSql,
  nova: NovaEmpresa,
): Promise<{ id: string }> {
  const branding = nova.accent === null ? null : { accent: nova.accent };

  const [org] = await tx<{ id: string }[]>`
    insert into orgs (name, cnpj, contract_start, contract_end, branding, created_by)
    values (${nova.nome}, ${nova.cnpj}, ${nova.inicio}, ${nova.fim},
            ${paraJsonb(branding)}::text::jsonb, ${nova.ator.id})
    returning id`;

  await tx`insert into org_wallets (org_id) values (${org.id})`;

  await registrarAuditoria(tx, {
    ator: nova.ator,
    orgId: org.id,
    acao: "criar_empresa",
    entidade: "orgs",
    entidadeId: org.id,
    depois: { nome: nova.nome, cnpj: nova.cnpj, inicio: nova.inicio, fim: nova.fim },
  });

  return { id: org.id };
}

export type NovoProfissional = {
  orgId: string;
  nome: string;
  email: string;
  cargo: string | null;
  area: string | null;
  ator: Ator;
};

/**
 * Profissional: perfil com `org_id` (invariante 9) e carteira vazia.
 *
 * A carteira entra na mesma transação pelo mesmo motivo da empresa — sem ela,
 * a primeira alocação encontraria `carteira inexistente`.
 */
export async function profissionalNaTransacao(
  tx: postgres.TransactionSql,
  userId: string,
  novo: NovoProfissional,
): Promise<void> {
  await tx`
    insert into profiles (id, org_id, role, name, email, job_title, area)
    values (${userId}, ${novo.orgId}, 'professional', ${novo.nome}, ${novo.email},
            ${novo.cargo}, ${novo.area})`;

  await tx`insert into wallets (user_id, org_id) values (${userId}, ${novo.orgId})`;

  await registrarAuditoria(tx, {
    ator: novo.ator,
    orgId: novo.orgId,
    acao: "criar_profissional",
    entidade: "profiles",
    entidadeId: userId,
    depois: { nome: novo.nome, email: novo.email, cargo: novo.cargo },
  });
}

export type NovaContaPessoal = {
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  ator: Ator;
  /**
   * Como a conta nasceu, para o histórico: a operadora criou à mão, ou aprovou
   * o pedido que a pessoa fez em `/cadastro` (A3). Uma linha de auditoria só,
   * com o verbo certo — duas para o mesmo gesto seriam ruído no feed.
   */
  acao?: "criar_conta_pessoal" | "aprovar_cadastro";
};

/**
 * A conta pessoal do Profissional avulso: uma `org` individual com a carteira
 * do contrato, o perfil e a carteira dele — tudo numa transação, pelo mesmo
 * motivo da empresa e do colaborador: o trigger de saldo só sabe somar.
 *
 * A `org` leva o nome da pessoa porque `name` é obrigatório e é o que a lista
 * da operadora mostra; ninguém de fora a vê como empresa (`partner_professionals`
 * e o feed de atividade escondem o nome quando o tipo é individual). Sem CNPJ e
 * sem marca: a conta pessoal usa a da plataforma. O CPF chega na primeira compra
 * pelo checkout (A4).
 *
 * O trigger `trg_profiles_individual_org` garante que esta `org` nunca terá um
 * segundo perfil.
 */
export async function contaPessoalNaTransacao(
  tx: postgres.TransactionSql,
  userId: string,
  nova: NovaContaPessoal,
): Promise<{ orgId: string }> {
  const [org] = await tx<{ id: string }[]>`
    insert into orgs (kind, name, created_by)
    values ('individual', ${nova.nome}, ${nova.ator.id})
    returning id`;

  await tx`insert into org_wallets (org_id) values (${org.id})`;

  await tx`
    insert into profiles (id, org_id, role, name, email, phone, job_title, area)
    values (${userId}, ${org.id}, 'professional', ${nova.nome}, ${nova.email}, ${nova.telefone},
            ${nova.cargo}, ${nova.area})`;

  await tx`insert into wallets (user_id, org_id) values (${userId}, ${org.id})`;

  await registrarAuditoria(tx, {
    ator: nova.ator,
    orgId: org.id,
    acao: nova.acao ?? "criar_conta_pessoal",
    entidade: "profiles",
    entidadeId: userId,
    depois: { nome: nova.nome, email: nova.email, cargo: nova.cargo },
  });

  return { orgId: org.id };
}

export type NovoParceiro = {
  nome: string;
  email: string;
  headline: string | null;
  bio: string | null;
  areas: string[];
  engajamento: Engajamento;
  maxPorSemana: number;
  fuso: string;
  ator: Ator;
};

/**
 * Parceiro criado direto pelo admin, já `active`.
 *
 * Invariante 9: sem `org_id` — o Parceiro é da plataforma e atende todas as
 * empresas. O `check` de `profiles` recusaria a linha com empresa, e é assim
 * que se quer.
 *
 * Invariante 8 continua de pé: `status` só chega a `active` por aqui, com
 * `service_role`. O próprio Parceiro não escreve essa coluna — o privilégio de
 * coluna da Etapa 3 tirou isso dele — e `approved_by` registra quem decidiu.
 */
export async function parceiroNaTransacao(
  tx: postgres.TransactionSql,
  userId: string,
  novo: NovoParceiro,
): Promise<void> {
  await tx`
    insert into profiles (id, role, name, email, timezone)
    values (${userId}, 'partner', ${novo.nome}, ${novo.email}, ${novo.fuso})`;

  await tx`
    insert into partners (id, status, headline, bio, areas, engagement, max_per_week,
                          approved_by, approved_at)
    values (${userId}, 'active', ${novo.headline}, ${novo.bio}, ${novo.areas},
            ${novo.engajamento}::engagement_type, ${novo.maxPorSemana},
            ${novo.ator.id}, now())`;

  await registrarAuditoria(tx, {
    ator: novo.ator,
    acao: "criar_parceiro",
    entidade: "partners",
    entidadeId: userId,
    depois: {
      nome: novo.nome,
      email: novo.email,
      engajamento: novo.engajamento,
      areas: novo.areas,
      status: "active",
    },
  });
}
