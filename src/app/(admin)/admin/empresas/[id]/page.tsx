import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ColaboradoresTabela } from "@/components/admin/ColaboradoresTabela";
import {
  AlocarFichasForm,
  NovoProfissionalForm,
  RegistrarContratoForm,
} from "@/components/admin/ContratoForms";
import { Migalhas } from "@/components/shell/Migalhas";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { CellStack } from "@/components/ui/Table";
import {
  buscarEmpresa,
  listarColaboradores,
  listarLancamentosDoContrato,
} from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig, loadTerms } from "@/lib/config/load";
import { cnpj, dataHora, dia, periodoDoContrato } from "@/lib/formato";
import { ehId } from "@/lib/forms";
import { rotuloDoLancamento } from "@/lib/ledger/rotulos";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).org };
}

/**
 * A tela de uma empresa: onde a ficha entra no sistema e onde ela é entregue.
 *
 * Os dois formulários de dinheiro recebem um `token` sorteado aqui, a cada
 * render (invariante 16). Como o layout raiz é `force-dynamic`, cada abertura
 * da página gera um token novo e cada reenvio do mesmo formulário reusa o
 * mesmo — que é exatamente a distinção que se quer entre "comprei duas vezes"
 * e "cliquei duas vezes".
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ para?: string | string[] }>;
}) {
  const sessao = await requireRole("admin", "moderator");
  const { id } = await params;
  if (!ehId(id)) notFound();
  const { para } = await searchParams;
  const config = await loadAppConfig();
  const t = config.terms;

  const empresa = await buscarEmpresa(id);
  if (empresa === null) notFound();

  // Sequencial pelo mesmo motivo do painel: conexão única não paraleliza, e
  // consulta Drizzle concorrente nela trava.
  const colaboradores = await listarColaboradores(empresa.id);
  const lancamentos = await listarLancamentosDoContrato(empresa.id);

  const ehOperadora = sessao.role === "admin";
  const alocadas = empresa.contratadas - empresa.saldo;
  const teto = config.fichaPolicy.maxBalance;

  // Só quem pode receber: acesso ativo. Alocar para conta desligada é ficha
  // parada numa carteira que ninguém abre.
  const alocaveis = colaboradores.filter((pessoa) => pessoa.ativo);
  const selecionado =
    typeof para === "string" && alocaveis.some((pessoa) => pessoa.id === para) ? para : undefined;

  return (
    <>
      <PageHeader
        eyebrow={
          <Migalhas itens={[{ rotulo: t.orgs, href: "/admin/empresas" }, { rotulo: cnpj(empresa.cnpj) }]} />
        }
        title={empresa.nome}
        description={periodoDoContrato(empresa.inicio, empresa.fim)}
        actions={
          empresa.ativa ? <Pill variant="on">Ativa</Pill> : <Pill variant="off">Inativa</Pill>
        }
      />

      <div className="flex flex-col gap-[18px]">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat value={empresa.contratadas} label="Contratadas" tone="gold" icone="contract" />
          <Stat value={empresa.saldo} label="Saldo do contrato" tone="gold" icone="wallet" />
          <Stat value={alocadas} label="Alocadas" icone="coins" />
          <Stat value={colaboradores.length} label="Colaboradores" icone="users" />
        </div>

        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-[18px]">
            <Card title="Colaboradores" icone="users">
              {colaboradores.length === 0 ? (
                <EmptyState
                  icone="user-plus"
                  title="Nenhum colaborador ainda"
                  description={`Crie o primeiro ao lado. A carteira nasce vazia e recebe ${t.fichas} por alocação.`}
                />
              ) : (
                <ColaboradoresTabela
                  orgId={empresa.id}
                  teto={teto}
                  colaboradores={colaboradores.map((pessoa) => ({
                    ...pessoa,
                    ultimoUso: pessoa.ultimoUso === null ? "nunca" : dia(pessoa.ultimoUso),
                  }))}
                />
              )}
            </Card>

            <Card
              title="Livro-caixa do contrato"
              icone="contract"
              action={
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
                  Não se apaga
                </span>
              }
            >
              {lancamentos.length === 0 ? (
                <EmptyState
                  icone="contract"
                  title="Nenhum lançamento"
                  description="Registre a compra do contrato para a primeira linha aparecer."
                />
              ) : (
                <ul className="flex flex-col">
                  {lancamentos.map((lancamento) => {
                    const tipo = rotuloDoLancamento(lancamento.tipo);
                    return (
                      <li
                        key={lancamento.id}
                        className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-t border-[#F3E4EC] py-2.5 first:border-t-0 first:pt-0"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-full bg-[#FBF1DE] text-[#C98A2E]"
                          title={tipo.rotulo}
                        >
                          <Icone nome={tipo.icone} tamanho={15} />
                        </span>
                        <CellStack
                          title={descrever(
                            tipo.rotulo,
                            lancamento.tipo,
                            lancamento.destino,
                            lancamento.motivo,
                          )}
                          sub={`${dataHora(lancamento.quando)}${lancamento.autor === null ? "" : ` · por ${lancamento.autor}`}`}
                        />
                        <span
                          className={`font-mono text-[13.5px] font-semibold tabular-nums ${
                            lancamento.quantidade > 0 ? "text-[#2E6B52]" : "text-[#2A1B26]"
                          }`}
                        >
                          {lancamento.quantidade > 0 ? "+" : "−"}
                          {Math.abs(lancamento.quantidade)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {ehOperadora ? (
            <div className="flex flex-col gap-[18px]">
              <Card title="Registrar contrato" icone="contract">
                <RegistrarContratoForm orgId={empresa.id} token={randomUUID()} />
              </Card>

              <Card title={`Alocar ${t.fichas}`} icone="coins" id="alocar" className="scroll-mt-6">
                <AlocarFichasForm
                  orgId={empresa.id}
                  token={randomUUID()}
                  selecionado={selecionado}
                  colaboradores={alocaveis.map((pessoa) => ({
                    id: pessoa.id,
                    nome: pessoa.nome,
                    saldo: pessoa.saldo,
                  }))}
                  teto={teto}
                  termoFichas={t.fichas}
                />
                <p className="mt-3.5 text-[12px] leading-[1.45] text-[#8E7C86]">
                  Alocar tira do contrato e põe na carteira numa transação só. Se um dos dois lados
                  falhar, nenhum dos dois acontece.
                </p>
              </Card>

              <Card title={`Novo ${t.professional}`} icone="user-plus">
                <NovoProfissionalForm orgId={empresa.id} termoProfissional={t.professional} />
              </Card>
            </div>
          ) : (
            <Card title="Só leitura">
              <p className="text-[13px] leading-[1.5] text-[#8E7C86]">
                A moderação lê o livro-caixa mas não lança nele. Contrato e alocação são da
                operadora.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** "Alocação para Mariana Costa", "Contrato anual 2026/2027", "Estorno". */
function descrever(
  rotulo: string,
  tipo: string,
  destino: string | null,
  motivo: string | null,
): string {
  if (tipo === "allocate" && destino !== null) return `${rotulo} para ${destino}`;
  if (tipo === "reclaim" && destino !== null) return `${rotulo} de ${destino}`;
  if (tipo === "purchase") return motivo ?? `${rotulo} de bloco`;
  return motivo === null ? rotulo : `${rotulo} — ${motivo}`;
}

