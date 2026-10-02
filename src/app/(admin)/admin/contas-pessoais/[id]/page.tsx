import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegistrarPacoteForm, type OpcaoDePacote } from "@/components/admin/ContaPessoalForms";
import { EditarProfissionalForm } from "@/components/admin/EditarProfissionalForm";
import { FeedDeAtividade } from "@/components/admin/FeedDeAtividade";
import { Migalhas } from "@/components/shell/Migalhas";
import { PageHeader } from "@/components/shell/PageHeader";
import { AcoesConfirmadas } from "@/components/ui/AcoesConfirmadas";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { alterarAcessoAcao, novaSenhaAcao } from "@/lib/admin/acoes";
import {
  buscarProfissional,
  contaPessoalDe,
  listarAtividade,
  listarPagamentos,
} from "@/lib/admin/consultas";
import { rotuloDoMeio, rotuloDoPagamento } from "@/lib/admin/rotulos";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig, loadTerms } from "@/lib/config/load";
import { getSql } from "@/lib/db";
import { dia, humanizar, parcelamento, reais } from "@/lib/formato";
import { ehId } from "@/lib/forms";
import { lotesDaCarteira } from "@/lib/ledger/lotes";
import { countFichas } from "@/lib/terms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).individual };
}

/**
 * A conta pessoal de uma pessoa: dados, carteira com os lotes e a validade de
 * cada um, os pacotes pagos e o registro de um pacote novo.
 *
 * A rota é pela pessoa, não pela `org`: a conta pessoal tem um dono só, e é ele
 * que a operadora procura. O `orgId` sai do perfil — e quem não é dono de
 * conta pessoal dá "não encontrado".
 *
 * O formulário do pacote recebe um `token` sorteado a cada render (invariante
 * 16), como o do contrato: reenviar colide, registrar outro pagamento não.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await requireRole("admin", "moderator");
  const { id: userId } = await params;
  if (!ehId(userId)) notFound();

  const config = await loadAppConfig();
  const t = config.terms;

  // Sequencial: conexão única, e consulta concorrente nela trava.
  const conta = await contaPessoalDe(userId);
  if (conta === null) notFound();
  const pessoa = await buscarProfissional(conta.orgId, userId);
  if (pessoa === null) notFound();
  const lotes = await lotesDaCarteira(getSql(), userId);
  const pagamentos = await listarPagamentos(userId);
  const historico = await listarAtividade({ entidadeId: userId, limite: 20 });

  const ehOperadora = sessao.role === "admin";
  const primeiroNome = pessoa.nome.split(/\s+/)[0];
  const agora = new Date();
  const meses = config.individualPolicy.validadeMeses;

  const nomeDoPacote = new Map(config.pacotes.map((p) => [p.id, p.nome]));
  const opcoes: OpcaoDePacote[] = config.pacotes
    .filter((p) => p.ativo)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      fichas: countFichas(p.fichas, t),
      preco: reais(p.precoCentavos),
      porFicha: reais(Math.round(p.precoCentavos / p.fichas)),
      parcelas: parcelamento(p.parcelasMax),
    }));

  const comFicha = lotes.filter((l) => l.restante > 0);
  const semLote = pessoa.saldo - comFicha.reduce((soma, l) => soma + l.restante, 0);

  return (
    <>
      <PageHeader
        lead={<Avatar name={pessoa.nome} size="lg" />}
        eyebrow={
          <Migalhas
            itens={[
              { rotulo: t.individuals, href: "/admin/contas-pessoais" },
              { rotulo: pessoa.nome },
            ]}
          />
        }
        title={pessoa.nome}
        description={[pessoa.cargo, `${t.individual} desde ${dia(pessoa.desde)}`]
          .filter(Boolean)
          .join(" · ")}
        actions={
          pessoa.ativo ? (
            <Pill variant="on">Acesso ativo</Pill>
          ) : (
            <Pill variant="off">Acesso desativado</Pill>
          )
        }
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-[18px]">
          <Card title="Carteira" icone="wallet">
            <div className="flex items-center gap-3">
              {pessoa.saldo > 0 && <FichaStack count={pessoa.saldo} />}
              <span className="font-display text-[34px] font-bold leading-none">
                {pessoa.saldo}
              </span>
              <span className="text-[12.5px] text-[#8E7C86]">
                {pessoa.saldo === 1 ? t.ficha : t.fichas} · compra não tem teto
              </span>
            </div>

            {comFicha.length > 0 && (
              <ul className="mt-4 flex flex-col divide-y divide-[#F3E4EC] border-t border-[#F3E4EC]">
                {comFicha.map((lote) => {
                  const vencido = lote.venceEm <= agora;
                  return (
                    <li key={lote.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-[13px]">
                        <span className="font-mono tabular-nums">{lote.restante}</span>
                        <span className="text-[#8E7C86]"> de {countFichas(lote.fichas, t)}</span>
                      </span>
                      {vencido ? (
                        <Pill variant="off">Venceu em {dia(lote.venceEm)}</Pill>
                      ) : (
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#8E7C86]">
                          <Icone nome="calendar-clock" tamanho={12} />
                          vale até {dia(lote.venceEm)}
                        </span>
                      )}
                    </li>
                  );
                })}
                {semLote > 0 && (
                  <li className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[13px]">
                      <span className="font-mono tabular-nums">{semLote}</span>
                      <span className="text-[#8E7C86]"> de presente ou estorno</span>
                    </span>
                    <span className="font-mono text-[11px] text-[#8E7C86]">não vence</span>
                  </li>
                )}
              </ul>
            )}

            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-[#8E7C86]">
              <Icone nome="clock" tamanho={12} />
              {pessoa.ultimoUso === null ? "Nunca usou" : `Último uso em ${dia(pessoa.ultimoUso)}`}
            </p>
          </Card>

          <Card title="Pacotes pagos" icone="coins">
            {pagamentos.length === 0 ? (
              <p className="text-[13px] text-[#8E7C86]">Nenhum pacote ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#F3E4EC]">
                {pagamentos.map((pagamento) => {
                  const status = rotuloDoPagamento(pagamento.status);
                  return (
                    <li
                      key={pagamento.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">
                          {nomeDoPacote.get(pagamento.pacote) ?? humanizar(pagamento.pacote)}
                          <span className="font-normal text-[#8E7C86]">
                            {" "}
                            · {countFichas(pagamento.fichas, t)}
                          </span>
                        </span>
                        <span className="block font-mono text-[11px] text-[#8E7C86]">
                          {dia(pagamento.pagoEm ?? pagamento.criadoEm)} ·{" "}
                          {rotuloDoMeio(pagamento.meio)}
                          {pagamento.referencia === null ? "" : ` · ${pagamento.referencia}`}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[13px] tabular-nums">
                          {reais(pagamento.valorCentavos)}
                        </span>
                        <Pill variant={status.cor}>{status.rotulo}</Pill>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Dados" icone="pencil">
            <EditarProfissionalForm
              id={pessoa.id}
              orgId={conta.orgId}
              dados={{
                nome: pessoa.nome,
                email: pessoa.email,
                cargo: pessoa.cargo,
                area: pessoa.area,
              }}
              somenteLeitura={!ehOperadora}
            />
            {conta.telefone !== null && (
              <p className="mt-3 font-mono text-[12px] text-[#8E7C86]">Telefone {conta.telefone}</p>
            )}
          </Card>

          <Card title="Histórico" icone="history">
            {historico.length === 0 ? (
              <p className="text-[13px] text-[#8E7C86]">Nenhuma decisão registrada ainda.</p>
            ) : (
              <FeedDeAtividade eventos={historico} t={t} />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          {ehOperadora && pessoa.ativo && (
            <Card title="Registrar pacote" icone="coins">
              <RegistrarPacoteForm
                userId={pessoa.id}
                token={randomUUID()}
                pacotes={opcoes}
                validade={`${meses} ${meses === 1 ? "mês" : "meses"}`}
                termoFichas={t.fichas}
              />
            </Card>
          )}

          <Card title="Acesso" icone="shield">
            <dl className="mb-3.5 flex flex-col gap-2 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#8E7C86]">Conta</dt>
                <dd>
                  {pessoa.ativo ? (
                    <Pill variant="on">Ativa</Pill>
                  ) : (
                    <Pill variant="off">Desativada</Pill>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#8E7C86]">Entra com</dt>
                <dd className="truncate font-mono text-[12px]">{pessoa.email}</dd>
              </div>
            </dl>

            {ehOperadora && (
              <div className="flex flex-col gap-3">
                {pessoa.ativo && (
                  <AcoesConfirmadas
                    acao={novaSenhaAcao}
                    campo="acao"
                    ocultos={{ id: pessoa.id, papel: "professional", orgId: conta.orgId }}
                    opcoes={[
                      {
                        valor: "senha",
                        rotulo: "Gerar nova senha provisória",
                        icone: "key",
                        pergunta: `Gerar uma senha nova para ${primeiroNome}? A atual deixa de valer na hora.`,
                        confirmar: "Gerar senha",
                      },
                    ]}
                  />
                )}
                <AcoesConfirmadas
                  acao={alterarAcessoAcao}
                  campo="ativo"
                  ocultos={{ id: pessoa.id, orgId: conta.orgId }}
                  opcoes={
                    pessoa.ativo
                      ? [
                          {
                            valor: "nao",
                            rotulo: "Desativar acesso",
                            icone: "user-x",
                            pergunta: `Desativar o acesso de ${primeiroNome}? A próxima entrada é recusada. A carteira e o histórico ficam.`,
                            confirmar: "Desativar",
                          },
                        ]
                      : [
                          {
                            valor: "sim",
                            rotulo: "Reativar acesso",
                            icone: "reactivate",
                            variante: "primary",
                          },
                        ]
                  }
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
