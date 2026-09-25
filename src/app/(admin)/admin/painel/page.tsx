import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import {
  listarAcoesRecentes,
  resumoDaPlataforma,
  utilizacaoPorEmpresa,
} from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadTerms } from "@/lib/config/load";
import { cap } from "@/lib/terms";

/**
 * O painel da operadora. Números de verdade, vindos do livro-caixa e da view
 * `org_usage` — nenhum deles é contado em memória.
 *
 * A utilização abre a tela porque é o indicador que sustenta a renovação:
 * empresa que paga e não usa não renova, então subutilização é problema de
 * produto e precisa estar onde se olha primeiro.
 */
export default async function Page() {
  const sessao = await requireRole("admin", "moderator");
  const t = await loadTerms();

  // Sequencial, e não `Promise.all`: a conexão de runtime é o pooler de
  // transação com `max: 1`, e duas consultas Drizzle concorrentes numa conexão
  // já usada travam de vez (ver a decisão no CLAUDE.md). Numa conexão só não há
  // paralelismo a ganhar — o `Promise.all` era risco sem prêmio.
  const resumo = await resumoDaPlataforma();
  const utilizacao = await utilizacaoPorEmpresa();
  const recentes = await listarAcoesRecentes();

  const ehOperadora = sessao.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title="Painel"
        description={`O piloto fechado é operado daqui. ${cap(t.org)}, contrato, ${t.partner} e ${t.ficha} passam todos por estas telas.`}
        actions={
          ehOperadora ? (
            <>
              <ButtonLink href="/admin/parceiros" variant="ghost">
                Novo {t.partner}
              </ButtonLink>
              <ButtonLink href="/admin/empresas">Nova {t.org.toLowerCase()}</ButtonLink>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-[18px]">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat value={resumo.empresasAtivas} label={`${t.orgs} ativas`} />
          <Stat value={resumo.fichasContratadas} label={`${t.fichas} contratadas`} tone="gold" />
          <Stat value={resumo.fichasAlocadas} label={`${t.fichas} alocadas`} tone="gold" />
          <Stat value={resumo.parceirosAtivos} label={`${t.partners} ativos`} />
        </div>

        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
          <Card title={`Utilização por ${t.org.toLowerCase()}`}>
            <p className="mb-4 text-[13px] leading-[1.5] text-[#8E7C86]">
              {cap(t.fichas)} usadas ÷ alocadas, desde o início do contrato. É a conta que decide
              renovação.
            </p>

            {utilizacao.length === 0 ? (
              <EmptyState
                title={`Nenhuma ${t.org.toLowerCase()} ainda`}
                description={
                  <>
                    Crie a primeira em{" "}
                    <Link href="/admin/empresas" className="text-[#C2317A] underline">
                      {t.orgs}
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.org}</Th>
                    <Th align="right">Alocadas</Th>
                    <Th align="right">Usadas</Th>
                    <Th>Utilização</Th>
                  </tr>
                </thead>
                <tbody>
                  {utilizacao.map((linha) => (
                    <tr key={linha.orgId} className="transition-colors hover:bg-[#FDF8FB]">
                      <Td>
                        <Link
                          href={`/admin/empresas/${linha.orgId}`}
                          className="font-semibold text-[#2A1B26] hover:text-[#C2317A]"
                        >
                          {linha.nome}
                        </Link>
                      </Td>
                      <Td align="right">
                        <span className="font-mono tabular-nums">{linha.alocadas}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono tabular-nums">{linha.usadas}</span>
                      </Td>
                      <Td>
                        <TaxaDeUso taxa={linha.taxa} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <div className="flex flex-col gap-[18px]">
            <Card title="Onde o dinheiro está">
              <dl className="flex flex-col gap-3">
                <Linha
                  rotulo={`Em contrato, não alocadas`}
                  valor={resumo.fichasEmContrato}
                  nota="Comprado pela empresa e ainda na mão dela."
                />
                <Linha
                  rotulo="Alocadas em carteiras"
                  valor={resumo.fichasAlocadas}
                  nota="Já entregues a alguém. Não voltam sem `reclaim`."
                />
                <Linha
                  rotulo="Já usadas em sessão"
                  valor={resumo.fichasUsadas}
                  nota="Viraram sessão de 30 minutos."
                />
                <Linha
                  rotulo={cap(t.professionals)}
                  valor={resumo.profissionais}
                  nota="Contas ativas em todas as empresas."
                />
              </dl>
            </Card>

            <Card title="Últimas decisões">
              {recentes.length === 0 ? (
                <p className="text-[13px] text-[#8E7C86]">
                  Nada registrado ainda. Toda ação da operadora grava{" "}
                  <span className="font-mono">audit_logs</span>.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {recentes.map((acao) => (
                    <li
                      key={acao.id}
                      className="flex items-center justify-between gap-3 border-t border-[#F3E4EC] py-2.5 first:border-t-0 first:pt-0"
                    >
                      <CellStack
                        title={<span className="font-mono text-[12px]">{acao.acao}</span>}
                        sub={acao.autor ?? "trabalho agendado"}
                      />
                      <time
                        dateTime={acao.quando.toISOString()}
                        className="shrink-0 font-mono text-[11px] text-[#8E7C86]"
                      >
                        {quando(acao.quando)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor, nota }: { rotulo: string; valor: number; nota: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[#F3E4EC] pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <dt className="text-[13.5px] font-semibold">{rotulo}</dt>
        <dd className="text-[12px] leading-[1.45] text-[#8E7C86]">{nota}</dd>
      </div>
      <dd className="shrink-0 font-mono text-[19px] font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

/**
 * Faixa de cor, não gradiente: verde acima de 70%, ouro entre 40 e 70, vermelho
 * abaixo. Os cortes são um chute informado, e estão aqui em vez de em
 * `app_config` porque ninguém ainda sabe qual é o número bom — quando souber,
 * a decisão muda de lugar.
 */
function TaxaDeUso({ taxa }: { taxa: number | null }) {
  if (taxa === null) return <span className="text-[12px] text-[#8E7C86]">sem alocação</span>;
  const variante = taxa >= 70 ? "on" : taxa >= 40 ? "wait" : "bad";
  return <Pill variant={variante}>{taxa}%</Pill>;
}

const FORMATO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/**
 * Data no fuso de São Paulo, resolvida no servidor.
 *
 * Invariante 2: o banco guarda `timestamptz` e a conversão acontece só na
 * borda de UI — que é aqui. O fuso é fixo no piloto; quando a operadora tiver
 * gente em outro fuso, ele vem de `profiles.timezone`.
 */
function quando(data: Date): string {
  return FORMATO.format(data);
}
