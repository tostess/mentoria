import type { Metadata } from "next";
import Link from "next/link";
import { NovaContaPessoalForm } from "@/components/admin/ContaPessoalForms";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import { listarContasPessoais } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig, loadTerms } from "@/lib/config/load";
import { dia } from "@/lib/formato";
import { cap } from "@/lib/terms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).individuals };
}

/**
 * As contas pessoais — o Profissional avulso, que compra os próprios pacotes.
 *
 * Mesma forma da tela de empresas, de propósito: lista à esquerda, criação à
 * direita. A diferença é o que se lê em cada linha — empresa por contrato,
 * conta pessoal por pessoa e pelo que ela comprou.
 *
 * A criação pela operadora é o caminho até o cadastro self-service (A3).
 */
export default async function Page() {
  const sessao = await requireRole("admin", "moderator");
  const config = await loadAppConfig();
  const t = config.terms;
  const contas = await listarContasPessoais();
  const meses = config.individualPolicy.validadeMeses;

  const ehOperadora = sessao.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title={t.individuals}
        description={`${cap(t.professionals)} que buscam mentoria por conta própria. Cada ${t.individual.toLowerCase()} compra pacotes de ${t.fichas}, que valem ${meses} ${meses === 1 ? "mês" : "meses"}.`}
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <Card
          title={cap(contagem(contas.length, t.individual, t.individuals))}
          icone="user"
          action={
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
              Saldo = na carteira
            </span>
          }
        >
          {contas.length === 0 ? (
            <EmptyState
              icone="user"
              title={`Nenhuma ${t.individual.toLowerCase()} ainda`}
              description={
                ehOperadora
                  ? `Use o formulário ao lado. A conta nasce com carteira vazia; o pacote é registrado na tela dela.`
                  : "A operadora ainda não criou nenhuma."
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Pessoa</Th>
                  <Th>Última compra</Th>
                  <Th align="right">Compradas</Th>
                  <Th align="right">Saldo</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {contas.map((conta) => (
                  <tr
                    key={conta.id}
                    className="group relative transition-colors hover:bg-[#FDF8FB] focus-within:bg-[#FDF8FB]"
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <CellStack
                          title={
                            <Link
                              href={`/admin/contas-pessoais/${conta.id}`}
                              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                            >
                              {conta.nome}
                            </Link>
                          }
                          sub={conta.email}
                        />
                        {!conta.ativo && <Pill variant="off">Desativada</Pill>}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-[#8E7C86]">
                        {conta.ultimaCompra === null ? "—" : dia(conta.ultimaCompra)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono tabular-nums">{conta.compradas}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono tabular-nums">{conta.saldo}</span>
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
          <Card title={`Nova ${t.individual.toLowerCase()}`} icone="user-plus">
            <NovaContaPessoalForm termoConta={t.individual} />
          </Card>
        ) : (
          <Card title="Só leitura">
            <p className="text-[13px] leading-[1.5] text-[#8E7C86]">
              A moderação acompanha as contas pessoais mas não cria conta nem registra pagamento.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular.toLowerCase() : plural.toLowerCase()}`;
}
