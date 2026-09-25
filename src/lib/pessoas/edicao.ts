import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import type { Ator } from "@/lib/ledger/operacoes";
import type { Engajamento } from "./operacoes";

/**
 * O que a operadora corrige numa pessoa que já existe.
 *
 * Mesmo desenho de `operacoes.ts`: recebe a transação em vez de abri-la, para o
 * teste chamar a função que a aplicação chama e desfazer tudo no fim. Sem
 * `server-only` — não lê segredo nem conecta.
 *
 * Cada edição lê a linha com `for update`, compara com o que chegou e audita
 * **só o que mudou**. Um `before`/`after` com o perfil inteiro dos dois lados
 * obrigaria quem lê o histórico a achar a diferença no olho; e salvar sem mudar
 * nada não grava linha nenhuma, para o histórico não se encher de "editou"
 * vazio a cada clique distraído.
 *
 * O que **não** está aqui é a troca de e-mail no servidor de auth — chamada
 * HTTP, fora de transação. Ela mora em `editar.ts`, junto da compensação.
 */

export class PessoaInexistente extends Error {
  constructor() {
    super("Esta pessoa não existe ou não pertence a esta empresa.");
    this.name = "PessoaInexistente";
  }
}

export class TransicaoInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "TransicaoInvalida";
  }
}

export class TemSessaoFutura extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "TemSessaoFutura";
  }
}

export type Diferenca<T> = {
  antes: Partial<T>;
  depois: Partial<T>;
  campos: (keyof T)[];
};

/**
 * Os campos em que `novo` difere de `atual`. Lista é comparada por conteúdo e
 * ordem — "Saúde, Liderança" não é a mesma chamada de busca que "Liderança,
 * Saúde" para quem lê o perfil, então conta como mudança.
 */
export function diferenca<T extends Record<string, unknown>>(atual: T, novo: T): Diferenca<T> {
  const antes: Partial<T> = {};
  const depois: Partial<T> = {};
  const campos: (keyof T)[] = [];

  for (const chave of Object.keys(novo) as (keyof T)[]) {
    if (JSON.stringify(atual[chave]) !== JSON.stringify(novo[chave])) {
      antes[chave] = atual[chave];
      depois[chave] = novo[chave];
      campos.push(chave);
    }
  }

  return { antes, depois, campos };
}

/**
 * Sessão que ainda vai acontecer. É o que impede de tirar o acesso de alguém
 * com sessão marcada: a outra ponta apareceria na sala sozinha, e a ficha
 * teria de ser devolvida à mão.
 */
async function sessoesFuturas(
  tx: postgres.TransactionSql,
  coluna: "partner_id" | "professional_id",
  id: string,
): Promise<number> {
  const [linha] = await tx<{ n: number }[]>`
    select count(*)::int as n
      from bookings
     where ${tx(coluna)} = ${id}
       and status in ('pending', 'confirmed')
       and end_at > now()`;
  return linha.n;
}

/** "Há 1 sessão marcada" / "Há 3 sessões marcadas". */
function hasSessoes(n: number): string {
  return n === 1 ? "Há 1 sessão marcada" : `Há ${n} sessões marcadas`;
}

// ---------------------------------------------------------------- Parceiro

export type DadosDoParceiro = {
  nome: string;
  email: string;
  fuso: string;
  headline: string | null;
  bio: string | null;
  areas: string[];
  habilidades: string[];
  senioridade: string | null;
  engajamento: Engajamento;
  maxPorSemana: number;
  bufferMin: number;
  confirmaSozinho: boolean;
};

/** Lê e trava. Devolve null se o id não é de um Parceiro. */
export async function parceiroParaEdicao(
  tx: postgres.TransactionSql,
  id: string,
): Promise<DadosDoParceiro | null> {
  const [linha] = await tx<
    {
      nome: string;
      email: string;
      fuso: string;
      headline: string | null;
      bio: string | null;
      areas: string[];
      habilidades: string[];
      senioridade: string | null;
      engajamento: Engajamento;
      max_por_semana: number;
      buffer_min: number;
      confirma_sozinho: boolean;
    }[]
  >`
    select p.name              as nome,
           p.email,
           p.timezone          as fuso,
           pa.headline,
           pa.bio,
           pa.areas,
           pa.skills           as habilidades,
           pa.seniority        as senioridade,
           pa.engagement::text as engajamento,
           pa.max_per_week     as max_por_semana,
           pa.buffer_min,
           pa.auto_confirm     as confirma_sozinho
      from profiles p
      join partners pa on pa.id = p.id
     where p.id = ${id}
       and p.role = 'partner'
       for update`;

  if (!linha) return null;
  return {
    nome: linha.nome,
    email: linha.email,
    fuso: linha.fuso,
    headline: linha.headline,
    bio: linha.bio,
    areas: linha.areas,
    habilidades: linha.habilidades,
    senioridade: linha.senioridade,
    engajamento: linha.engajamento,
    maxPorSemana: linha.max_por_semana,
    bufferMin: linha.buffer_min,
    confirmaSozinho: linha.confirma_sozinho,
  };
}

export type ResultadoDaEdicao = { campos: string[] };

export async function edicaoParceiroNaTransacao(
  tx: postgres.TransactionSql,
  id: string,
  novo: DadosDoParceiro,
  ator: Ator,
): Promise<ResultadoDaEdicao> {
  const atual = await parceiroParaEdicao(tx, id);
  if (atual === null) throw new PessoaInexistente();

  const mudanca = diferenca(atual, novo);
  if (mudanca.campos.length === 0) return { campos: [] };

  await tx`
    update profiles
       set name = ${novo.nome}, email = ${novo.email}, timezone = ${novo.fuso}
     where id = ${id}`;

  // `status` fica de fora de propósito: muda por `statusParceiroNaTransacao`,
  // que confere a transição e as sessões marcadas. Um formulário de dados que
  // arquivasse alguém de passagem seria o atalho que a invariante 8 fecha.
  await tx`
    update partners
       set headline     = ${novo.headline},
           bio          = ${novo.bio},
           areas        = ${novo.areas},
           skills       = ${novo.habilidades},
           seniority    = ${novo.senioridade},
           engagement   = ${novo.engajamento}::engagement_type,
           max_per_week = ${novo.maxPorSemana},
           buffer_min   = ${novo.bufferMin},
           auto_confirm = ${novo.confirmaSozinho}
     where id = ${id}`;

  await registrarAuditoria(tx, {
    ator,
    acao: "editar_parceiro",
    entidade: "partners",
    entidadeId: id,
    antes: mudanca.antes,
    depois: mudanca.depois,
  });

  return { campos: mudanca.campos.map(String) };
}

/** Os três estados que a operadora move no piloto. Os de convite são F1.5. */
export const STATUS_OPERAVEIS = ["active", "paused", "archived"] as const;
export type StatusOperavel = (typeof STATUS_OPERAVEIS)[number];

/**
 * Para onde cada estado pode ir. Arquivado só volta para ativo — voltar para
 * "pausado" seria reativar o acesso de alguém para deixá-lo invisível, que
 * não é uma decisão que alguém toma.
 */
export const TRANSICOES: Record<string, readonly StatusOperavel[]> = {
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: ["active"],
};

/**
 * Pausar esconde da busca e mantém o acesso — é o que se faz antes de férias,
 * e as sessões já marcadas continuam de pé. Arquivar esconde **e** tira o
 * acesso (`profiles.active = false`), e por isso é recusado com sessão futura.
 * Reativar desfaz as duas coisas.
 *
 * Invariante 8: `status` só muda aqui, fora da RLS e com `audit_logs`.
 */
export async function statusParceiroNaTransacao(
  tx: postgres.TransactionSql,
  id: string,
  novo: StatusOperavel,
  ator: Ator,
): Promise<{ antes: string }> {
  const [linha] = await tx<{ status: string }[]>`
    select status::text from partners where id = ${id} for update`;
  if (!linha) throw new PessoaInexistente();

  const permitidos = TRANSICOES[linha.status] ?? [];
  if (!permitidos.includes(novo)) {
    throw new TransicaoInvalida("Esta mudança de status não é permitida a partir do estado atual.");
  }

  if (novo === "archived") {
    const n = await sessoesFuturas(tx, "partner_id", id);
    if (n > 0) {
      throw new TemSessaoFutura(
        `${hasSessoes(n)} ainda por acontecer. Pause em vez de arquivar, ou espere passarem.`,
      );
    }
  }

  await tx`update partners set status = ${novo}::partner_status where id = ${id}`;

  if (novo === "archived" || linha.status === "archived") {
    await tx`update profiles set active = ${novo !== "archived"} where id = ${id}`;
  }

  await registrarAuditoria(tx, {
    ator,
    acao: "alterar_status_parceiro",
    entidade: "partners",
    entidadeId: id,
    antes: { status: linha.status },
    depois: { status: novo },
  });

  return { antes: linha.status };
}

// ------------------------------------------------------------ Profissional

export type DadosDoProfissional = {
  nome: string;
  email: string;
  cargo: string | null;
  area: string | null;
};

/**
 * Lê e trava, **conferindo a empresa**. O `orgId` vem da URL da tela; sem
 * esta conferência, um POST forjado editaria o colaborador de outra empresa.
 */
async function profissionalParaEdicao(
  tx: postgres.TransactionSql,
  id: string,
  orgId: string,
): Promise<DadosDoProfissional | null> {
  const [linha] = await tx<DadosDoProfissional[]>`
    select name as nome, email, job_title as cargo, area
      from profiles
     where id = ${id}
       and org_id = ${orgId}
       and role = 'professional'
       and deleted_at is null
       for update`;
  return linha ?? null;
}

/** `role` e `org_id` não são editáveis: mudar alguém de empresa é outra operação. */
export async function edicaoProfissionalNaTransacao(
  tx: postgres.TransactionSql,
  id: string,
  orgId: string,
  novo: DadosDoProfissional,
  ator: Ator,
): Promise<ResultadoDaEdicao> {
  const atual = await profissionalParaEdicao(tx, id, orgId);
  if (atual === null) throw new PessoaInexistente();

  const mudanca = diferenca(atual, novo);
  if (mudanca.campos.length === 0) return { campos: [] };

  await tx`
    update profiles
       set name = ${novo.nome}, email = ${novo.email}, job_title = ${novo.cargo}, area = ${novo.area}
     where id = ${id}`;

  await registrarAuditoria(tx, {
    ator,
    orgId,
    acao: "editar_profissional",
    entidade: "profiles",
    entidadeId: id,
    antes: mudanca.antes,
    depois: mudanca.depois,
  });

  return { campos: mudanca.campos.map(String) };
}

/**
 * Liga ou desliga a entrada do Profissional. O hook de access token já exclui
 * `active = false` (Etapa 4), então a próxima emissão de token sai sem papel e
 * o proxy manda para "acesso inativo". O token que a pessoa já tem vale até
 * expirar — não há revogação instantânea sem derrubar todas as sessões dela.
 *
 * Não devolve ficha. `reclaim` ao desligar alguém é pergunta em aberto no
 * CLAUDE.md, e desativar por engano não pode custar o saldo de ninguém.
 *
 * Só Profissional: o acesso do Parceiro acompanha o status (arquivar desliga),
 * e ter duas chaves para a mesma porta é como elas ficam discordando.
 */
export async function acessoNaTransacao(
  tx: postgres.TransactionSql,
  id: string,
  orgId: string,
  ativo: boolean,
  ator: Ator,
): Promise<{ mudou: boolean }> {
  const [linha] = await tx<{ active: boolean }[]>`
    select active
      from profiles
     where id = ${id}
       and org_id = ${orgId}
       and role = 'professional'
       and deleted_at is null
       for update`;
  if (!linha) throw new PessoaInexistente();
  if (linha.active === ativo) return { mudou: false };

  if (!ativo) {
    const n = await sessoesFuturas(tx, "professional_id", id);
    if (n > 0) {
      throw new TemSessaoFutura(
        `${hasSessoes(n)} ainda por acontecer. Desativar agora deixaria a outra ponta esperando na sala.`,
      );
    }
  }

  await tx`update profiles set active = ${ativo} where id = ${id}`;

  await registrarAuditoria(tx, {
    ator,
    orgId,
    acao: ativo ? "reativar_conta" : "desativar_conta",
    entidade: "profiles",
    entidadeId: id,
    antes: { active: !ativo },
    depois: { active: ativo },
  });

  return { mudou: true };
}
