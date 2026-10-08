import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import { brandingParaBanco, parseBranding } from "@/lib/config/app-config";
import { paraJsonb } from "@/lib/db/jsonb";
import type { Ator } from "@/lib/ledger/operacoes";
import { diferenca } from "@/lib/pessoas/edicao";
import { CORES_DA_MARCA, DEFAULT_THEME, ajustesDaMarca, type AjustesDeCor, type Branding } from "@/lib/theme";

/**
 * A marca de uma empresa, escrita pela operadora (F4b).
 *
 * Mesmo desenho de `pessoas/edicao.ts`: recebe a transação em vez de abri-la,
 * para o teste chamar a função que a aplicação chama e desfazer tudo no fim.
 * Sem `server-only` — não lê segredo nem conecta.
 *
 * Só empresa. A conta pessoal é uma `org` de um só e usa a marca da plataforma
 * ("Profissional avulso", no CLAUDE.md); a tela dela não oferece o formulário,
 * e é aqui que um POST forjado bate.
 */

export class EmpresaInexistente extends Error {
  constructor() {
    super("Esta empresa não existe.");
    this.name = "EmpresaInexistente";
  }
}

/** O que a operadora decide. `null` é "herdar da plataforma". */
export type MarcaDaEmpresa = {
  accent: string | null;
  nomeNaMarca: string | null;
  logotipo: string | null;
  cores: AjustesDeCor;
};

export function marcaDoBranding(branding: Branding): MarcaDaEmpresa {
  return {
    accent: branding.accent,
    nomeNaMarca: branding.name,
    logotipo: branding.logoUrl,
    cores: ordenadas(branding.cores ?? {}),
  };
}

/** Mesma ordem dos dois lados, para a comparação por conteúdo não ver mudança onde só a ordem mudou. */
function ordenadas(cores: AjustesDeCor): AjustesDeCor {
  const saida: AjustesDeCor = {};
  for (const cor of CORES_DA_MARCA) if (cores[cor] !== undefined) saida[cor] = cores[cor];
  return saida;
}

/** Lê e trava. Devolve null se o id não é de uma empresa. */
export async function marcaParaEdicao(
  tx: postgres.TransactionSql,
  orgId: string,
): Promise<MarcaDaEmpresa | null> {
  const [linha] = await tx<{ branding: unknown }[]>`
    select branding from orgs where id = ${orgId} and kind = 'empresa' for update`;
  return linha ? marcaDoBranding(parseBranding(linha.branding)) : null;
}

export async function marcaNaTransacao(
  tx: postgres.TransactionSql,
  orgId: string,
  nova: MarcaDaEmpresa,
  ator: Ator,
  accentDaPlataforma: string = DEFAULT_THEME.accent,
): Promise<{ campos: string[] }> {
  const atual = await marcaParaEdicao(tx, orgId);
  if (atual === null) throw new EmpresaInexistente();

  // O ajuste fino é guardado em relação ao accent que vai valer: sem accent
  // próprio, o da plataforma.
  const normalizada: MarcaDaEmpresa = {
    ...nova,
    cores: ajustesDaMarca(nova.accent ?? accentDaPlataforma, nova.cores),
  };

  const mudanca = diferenca(atual, normalizada);
  if (mudanca.campos.length === 0) return { campos: [] };

  const branding = brandingParaBanco({
    accent: normalizada.accent,
    name: normalizada.nomeNaMarca,
    logoUrl: normalizada.logotipo,
    cores: normalizada.cores,
  });

  await tx`update orgs set branding = ${paraJsonb(branding)}::text::jsonb where id = ${orgId}`;

  await registrarAuditoria(tx, {
    ator,
    orgId,
    acao: "editar_marca",
    entidade: "orgs",
    entidadeId: orgId,
    antes: mudanca.antes,
    depois: mudanca.depois,
  });

  return { campos: mudanca.campos as string[] };
}
