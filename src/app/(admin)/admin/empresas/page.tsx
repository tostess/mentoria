import type { Metadata } from "next";
import Link from "next/link";
import { NovaEmpresaForm } from "@/components/admin/NovaEmpresaForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import { listarEmpresas } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadTerms } from "@/lib/config/load";
import { cnpj } from "@/lib/formato";
import { cap } from "@/lib/terms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).orgs };
}

/**
 * As empresas contratantes.
 *
 * O formulário de criação fica na mesma tela da lista, e não atrás de um
 * botão, porque no piloto a lista tem quatro linhas: esconder um formulário de
 * cinco campos para mostrar quatro linhas é cerimônia sem ganho.
 *
 * O moderador vê a lista e não vê o formulário — ele não mexe em contrato.
 */
export default async function Page() {
  const sessao = await requireRole("admin", "moderator");
  const t = await loadTerms();
  const empresas = await listarEmpresas();

  const ehOperadora = sessao.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title={t.orgs}
        description={`Cada ${t.org.toLowerCase()} contratante compra um bloco de ${t.fichas} e o ${t.orgAdmin} distribui entre os colaboradores que escolher.`}
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <Card
          title={cap(contagem(empresas.length, t.org, t.orgs))}
          icone="building"
          action={
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
              Saldo = não alocadas
            </span>
          }
        >
          {empresas.length === 0 ? (
            <EmptyState
              icone="building"
              title={`Nenhuma ${t.org.toLowerCase()} ainda`}
              description={
                ehOperadora
                  ? "Use o formulário ao lado. A empresa nasce com contrato zero."
                  : "A operadora ainda não cadastrou nenhuma."
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.org}</Th>
                  <Th>CNPJ</Th>
                  <Th align="right">Contrato</Th>
                  <Th align="right">Saldo</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr
                    key={empresa.id}
                    className="group relative transition-colors hover:bg-[#FDF8FB] focus-within:bg-[#FDF8FB]"
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <CellStack
                          title={
                            <Link
                              href={`/admin/empresas/${empresa.id}`}
                              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                            >
                              {empresa.nome}
                            </Link>
                          }
                          sub={contagem(empresa.colaboradores, "colaborador", "colaboradores")}
                        />
                        {!empresa.ativa && <Pill variant="off">Inativa</Pill>}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-[#8E7C86]">
                        {empresa.cnpj === null ? "—" : cnpj(empresa.cnpj)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono tabular-nums">{empresa.contratadas}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono tabular-nums">{empresa.saldo}</span>
                    </Td>
                    <Td align="right" className="w-8">
                      <Icone
                        nome="chevron-right"
                        className="text-[#D9C3CF] transition-colors group-hover:text-[#C2317A]"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {ehOperadora ? (
          <Card title={`Nova ${t.org.toLowerCase()}`} icone="building">
            <NovaEmpresaForm termoEmpresa={t.org} />
            <p className="mt-3.5 text-[12px] leading-[1.45] text-[#8E7C86]">
              {cap(t.org)} nasce com contrato zero. O bloco de {t.fichas} é registrado depois, na
              tela dela — é o lançamento que cria a moeda.
            </p>
          </Card>
        ) : (
          <Card title="Só leitura">
            <p className="text-[13px] leading-[1.5] text-[#8E7C86]">
              A moderação acompanha as empresas mas não mexe em contrato nem em aparência.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

/** "1 empresa" / "4 empresas" — plural sem `Intl.PluralRules` para dois casos. */
function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular.toLowerCase() : plural.toLowerCase()}`;
}
