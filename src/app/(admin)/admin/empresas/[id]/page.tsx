import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlocarFichasForm,
  NovoProfissionalForm,
  RegistrarContratoForm,
} from "@/components/admin/ContratoForms";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FichaStack } from "@/components/ui/Ficha";
import { Pill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import {
  buscarEmpresa,
  listarColaboradores,
  listarLancamentosDoContrato,
} from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { cap } from "@/lib/terms";

/**
 * A tela de uma empresa: onde a ficha entra no sistema e onde ela é entregue.
 *
 * Os dois formulários de dinheiro recebem um `token` sorteado aqui, a cada
 * render (invariante 16). Como o layout raiz é `force-dynamic`, cada abertura
 * da página gera um token novo e cada reenvio do mesmo formulário reusa o
 * mesmo — que é exatamente a distinção que se quer entre "comprei duas vezes"
 * e "cliquei duas vezes".
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await requireRole("admin", "moderator");
  const { id } = await params;
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

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link href="/admin/empresas" className="hover:text-[#C2317A]">
              {t.orgs}
            </Link>
            {" · "}
            {cnpj(empresa.cnpj)}
          </>
        }
        title={empresa.nome}
        description={periodo(empresa.inicio, empresa.fim)}
        actions={
          empresa.ativa ? <Pill variant="on">Ativa</Pill> : <Pill variant="off">Inativa</Pill>
        }
      />

      <div className="flex flex-col gap-[18px]">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat value={empresa.contratadas} label="Contratadas" tone="gold" />
          <Stat value={empresa.saldo} label="Saldo do contrato" tone="gold" />
          <Stat value={alocadas} label="Alocadas" />
          <Stat value={colaboradores.length} label="Colaboradores" />
        </div>

        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-[18px]">
            <Card title="Colaboradores">
              {colaboradores.length === 0 ? (
                <EmptyState
                  title="Nenhum colaborador ainda"
                  description={`Crie o primeiro ao lado. A carteira nasce vazia e recebe ${t.fichas} por alocação.`}
                />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Pessoa</Th>
                      <Th>Cargo</Th>
                      <Th align="right">{cap(t.fichas)}</Th>
                      <Th>Último uso</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradores.map((pessoa) => (
                      <tr key={pessoa.id} className="transition-colors hover:bg-[#FDF8FB]">
                        <Td>
                          <CellStack title={pessoa.nome} sub={pessoa.email} />
                        </Td>
                        <Td>
                          <span className="text-[13px]">{pessoa.cargo ?? "—"}</span>
                        </Td>
                        <Td align="right">
                          {pessoa.saldo === 0 ? (
                            <span className="text-[12px] text-[#8E7C86]">sem {t.ficha}</span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <FichaStack count={pessoa.saldo} max={config.fichaPolicy.maxBalance} />
                              <span className="font-mono tabular-nums">{pessoa.saldo}</span>
                            </span>
                          )}
                        </Td>
                        <Td>
                          <span className="font-mono text-[12px] text-[#8E7C86]">
                            {pessoa.ultimoUso === null ? "nunca" : dia(pessoa.ultimoUso)}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card
              title="Livro-caixa do contrato"
              action={
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
                  Append-only
                </span>
              }
            >
              {lancamentos.length === 0 ? (
                <EmptyState
                  title="Nenhum lançamento"
                  description="Registre a compra do contrato para a primeira linha aparecer."
                />
              ) : (
                <ul className="flex flex-col">
                  {lancamentos.map((lancamento) => (
                    <li
                      key={lancamento.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-[#F3E4EC] py-2.5 first:border-t-0 first:pt-0"
                    >
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#8E7C86]">
                        {lancamento.tipo}
                      </span>
                      <CellStack
                        title={descrever(lancamento.tipo, lancamento.destino, lancamento.motivo)}
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
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {ehOperadora ? (
            <div className="flex flex-col gap-[18px]">
              <Card title="Registrar contrato">
                <RegistrarContratoForm orgId={empresa.id} token={randomUUID()} />
              </Card>

              <Card title={`Alocar ${t.fichas}`}>
                <AlocarFichasForm
                  orgId={empresa.id}
                  token={randomUUID()}
                  colaboradores={colaboradores.map((pessoa) => ({
                    id: pessoa.id,
                    nome: pessoa.nome,
                    saldo: pessoa.saldo,
                  }))}
                  teto={config.fichaPolicy.maxBalance}
                  termoFichas={t.fichas}
                />
                <p className="mt-3.5 text-[12px] leading-[1.45] text-[#8E7C86]">
                  Alocar tira do contrato e põe na carteira numa transação só. Se um dos dois lados
                  falhar, nenhum dos dois acontece.
                </p>
              </Card>

              <Card title={`Novo ${t.professional}`}>
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

/** Descrição humana do lançamento, a partir do tipo e de quem recebeu. */
function descrever(tipo: string, destino: string | null, motivo: string | null): string {
  if (tipo === "allocate" && destino !== null) return `Alocação para ${destino}`;
  if (tipo === "purchase") return motivo ?? "Compra de bloco";
  if (tipo === "reclaim" && destino !== null) return `Devolução de ${destino}`;
  return motivo ?? tipo;
}

function cnpj(digitos: string | null): string {
  if (digitos === null) return "sem CNPJ";
  if (digitos.length !== 14) return digitos;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

/**
 * Datas de contrato são `date`, não `timestamptz`: chegam como `YYYY-MM-DD` e
 * são formatadas por corte de string. Passá-las por `new Date()` as colocaria
 * em UTC e o dia 1º viraria o dia 31 do mês anterior em São Paulo.
 */
function diaDoContrato(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function periodo(inicio: string | null, fim: string | null): string {
  if (inicio === null && fim === null) return "Contrato sem período registrado.";
  if (inicio !== null && fim !== null) {
    return `Contrato de ${diaDoContrato(inicio)} a ${diaDoContrato(fim)}.`;
  }
  if (inicio !== null) return `Contrato a partir de ${diaDoContrato(inicio)}.`;
  return `Contrato até ${diaDoContrato(fim!)}.`;
}

const DIA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Invariante 2: `timestamptz` só vira texto local aqui, na borda. */
function dia(data: Date): string {
  return DIA.format(data);
}

function dataHora(data: Date): string {
  return DATA_HORA.format(data);
}
