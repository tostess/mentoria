import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditarProfissionalForm } from "@/components/admin/EditarProfissionalForm";
import { FeedDeAtividade } from "@/components/admin/FeedDeAtividade";
import { Migalhas } from "@/components/shell/Migalhas";
import { PageHeader } from "@/components/shell/PageHeader";
import { AcoesConfirmadas } from "@/components/ui/AcoesConfirmadas";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { alterarAcessoAcao, novaSenhaAcao } from "@/lib/admin/acoes";
import { buscarProfissional, listarAtividade, nomeDaEmpresa } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig, loadTerms } from "@/lib/config/load";
import { dia } from "@/lib/formato";
import { ehId } from "@/lib/forms";
import { cap, countFichas } from "@/lib/terms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).professional };
}

/**
 * Um colaborador de uma empresa: dados, carteira, acesso e histórico.
 *
 * A empresa vem da URL e é conferida na consulta — `buscarProfissional` só
 * devolve a pessoa se ela for daquela empresa. Trocar o id da empresa na
 * barra de endereço dá "não encontrado", não a pessoa de outra contratante.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const sessao = await requireRole("admin", "moderator");
  const { id: orgId, userId } = await params;
  if (!ehId(orgId) || !ehId(userId)) notFound();

  const config = await loadAppConfig();
  const t = config.terms;

  // Sequencial: conexão única, e consulta Drizzle concorrente nela trava.
  const pessoa = await buscarProfissional(orgId, userId);
  if (pessoa === null) notFound();
  const empresa = await nomeDaEmpresa(orgId);
  const historico = await listarAtividade({ entidadeId: userId, limite: 20 });

  const ehOperadora = sessao.role === "admin";
  const primeiroNome = pessoa.nome.split(/\s+/)[0];
  const teto = config.fichaPolicy.maxBalance;

  return (
    <>
      <PageHeader
        lead={<Avatar name={pessoa.nome} size="lg" />}
        eyebrow={
          <Migalhas
            itens={[
              { rotulo: t.orgs, href: "/admin/empresas" },
              { rotulo: empresa ?? t.org, href: `/admin/empresas/${orgId}` },
              { rotulo: pessoa.nome },
            ]}
          />
        }
        title={pessoa.nome}
        description={[pessoa.cargo, `${t.professional} desde ${dia(pessoa.desde)}`]
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
          <Card title="Dados" icone="pencil">
            <EditarProfissionalForm
              id={pessoa.id}
              orgId={orgId}
              dados={{
                nome: pessoa.nome,
                email: pessoa.email,
                cargo: pessoa.cargo,
                area: pessoa.area,
              }}
              somenteLeitura={!ehOperadora}
            />
          </Card>

          <Card title="Histórico" icone="history">
            {historico.length === 0 ? (
              <p className="text-[13px] text-stone">Nenhuma decisão registrada ainda.</p>
            ) : (
              <FeedDeAtividade eventos={historico} t={t} />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card title="Carteira" icone="wallet">
            <div className="flex items-center gap-3">
              {pessoa.saldo > 0 && <FichaStack count={pessoa.saldo} max={teto} />}
              <span className="font-display text-[34px] font-bold leading-none">
                {pessoa.saldo}
              </span>
              <span className="text-[12.5px] text-stone">
                {pessoa.saldo === 1 ? t.ficha : t.fichas} · teto {teto}
              </span>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-stone">
              <Icone nome="clock" tamanho={12} />
              {pessoa.ultimoUso === null ? "Nunca usou" : `Último uso em ${dia(pessoa.ultimoUso)}`}
            </p>
            {ehOperadora && pessoa.ativo && pessoa.saldo < teto && (
              <ButtonLink
                href={`/admin/empresas/${orgId}?para=${pessoa.id}#alocar`}
                variant="ghost"
                size="sm"
                className="mt-3.5"
              >
                <Icone nome="coins" tamanho={14} />
                {cap(`alocar ${t.fichas}`)}
              </ButtonLink>
            )}
            {pessoa.saldo >= teto && (
              <p className="mt-3 text-[12px] text-stone">
                No teto: {countFichas(teto, t)} por carteira.
              </p>
            )}
          </Card>

          <Card title="Acesso" icone="shield">
            <dl className="mb-3.5 flex flex-col gap-2 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone">Conta</dt>
                <dd>
                  {pessoa.ativo ? (
                    <Pill variant="on">Ativa</Pill>
                  ) : (
                    <Pill variant="off">Desativada</Pill>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone">Entra com</dt>
                <dd className="truncate font-mono text-[12px]">{pessoa.email}</dd>
              </div>
            </dl>

            {ehOperadora && (
              <div className="flex flex-col gap-3">
                {pessoa.ativo && (
                  <AcoesConfirmadas
                    acao={novaSenhaAcao}
                    campo="acao"
                    ocultos={{ id: pessoa.id, papel: "professional", orgId }}
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
                  ocultos={{ id: pessoa.id, orgId }}
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
