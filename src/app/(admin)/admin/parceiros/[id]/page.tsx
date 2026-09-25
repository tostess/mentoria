import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditarParceiroForm } from "@/components/admin/EditarParceiroForm";
import { FeedDeAtividade } from "@/components/admin/FeedDeAtividade";
import { Migalhas } from "@/components/shell/Migalhas";
import { PageHeader } from "@/components/shell/PageHeader";
import { AcoesConfirmadas, type OpcaoConfirmada } from "@/components/ui/AcoesConfirmadas";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { alterarStatusParceiroAcao, novaSenhaAcao } from "@/lib/admin/acoes";
import { buscarParceiro, listarAtividade } from "@/lib/admin/consultas";
import {
  corDoStatus,
  explicacaoDoStatus,
  rotuloDoStatus,
  rotuloDoVinculo,
} from "@/lib/admin/rotulos";
import { requireRole } from "@/lib/auth/session";
import { loadTerms } from "@/lib/config/load";
import { dia } from "@/lib/formato";
import { ehId } from "@/lib/forms";
import { TRANSICOES } from "@/lib/pessoas/edicao";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).partner };
}

/**
 * Um Parceiro, pela mão da operadora: dados, status, acesso e histórico.
 *
 * O moderador vê tudo e não mexe em nada — os formulários chegam desabilitados
 * e as ações nem aparecem. A recusa de verdade está na Server Action, que
 * repete `requireRole("admin")`; esconder aqui é só não oferecer o que ia
 * falhar.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await requireRole("admin", "moderator");
  const { id } = await params;
  if (!ehId(id)) notFound();
  const t = await loadTerms();

  const parceiro = await buscarParceiro(id);
  if (parceiro === null) notFound();
  // Sequencial: conexão única, e consulta Drizzle concorrente nela trava.
  const historico = await listarAtividade({ entidadeId: id, limite: 20 });

  const ehOperadora = sessao.role === "admin";
  const primeiroNome = parceiro.nome.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        lead={<Avatar name={parceiro.nome} size="lg" />}
        eyebrow={
          <Migalhas
            itens={[{ rotulo: t.partners, href: "/admin/parceiros" }, { rotulo: parceiro.nome }]}
          />
        }
        title={parceiro.nome}
        description={[
          parceiro.headline,
          rotuloDoVinculo(parceiro.engajamento),
          `desde ${dia(parceiro.desde)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Pill variant={corDoStatus(parceiro.status)}>{rotuloDoStatus(parceiro.status)}</Pill>
        }
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <Card title="Dados" icone="pencil">
          <EditarParceiroForm id={parceiro.id} dados={parceiro} somenteLeitura={!ehOperadora} />
        </Card>

        <div className="flex flex-col gap-[18px]">
          <Card
            title="Status"
            action={
              <Pill variant={corDoStatus(parceiro.status)}>{rotuloDoStatus(parceiro.status)}</Pill>
            }
          >
            <p className="mb-3.5 text-[13px] leading-[1.5] text-[#8E7C86]">
              {explicacaoDoStatus(parceiro.status)}
            </p>
            {ehOperadora && (
              <AcoesConfirmadas
                acao={alterarStatusParceiroAcao}
                campo="status"
                ocultos={{ id: parceiro.id }}
                opcoes={opcoesDeStatus(parceiro.status, primeiroNome)}
              />
            )}
          </Card>

          <Card title="Acesso" icone="shield">
            <dl className="mb-3.5 flex flex-col gap-2 text-[13.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#8E7C86]">Conta</dt>
                <dd>
                  {parceiro.ativo ? (
                    <Pill variant="on">Ativa</Pill>
                  ) : (
                    <Pill variant="off">Sem acesso</Pill>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#8E7C86]">Entra com</dt>
                <dd className="truncate font-mono text-[12px]">{parceiro.email}</dd>
              </div>
            </dl>
            {ehOperadora && parceiro.ativo && (
              <AcoesConfirmadas
                acao={novaSenhaAcao}
                campo="acao"
                ocultos={{ id: parceiro.id, papel: "partner" }}
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
            {!parceiro.ativo && (
              <p className="text-[12.5px] leading-[1.5] text-[#8E7C86]">
                O acesso volta junto com a reativação, no card de status.
              </p>
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
      </div>
    </>
  );
}

/** Os botões que o status atual permite, na ordem em que fazem sentido. */
function opcoesDeStatus(status: string, nome: string): OpcaoConfirmada[] {
  const destinos = TRANSICOES[status] ?? [];
  return destinos.map((destino): OpcaoConfirmada => {
    switch (destino) {
      case "active":
        return { valor: "active", rotulo: "Reativar", icone: "reactivate", variante: "primary" };
      case "paused":
        return {
          valor: "paused",
          rotulo: "Pausar",
          icone: "pause",
          pergunta: `Pausar ${nome}? Sai da busca, mas continua entrando e as sessões já marcadas seguem.`,
        };
      case "archived":
        return {
          valor: "archived",
          rotulo: "Arquivar",
          icone: "archive",
          pergunta: `Arquivar ${nome}? Sai da busca e perde o acesso. Dá para reativar depois.`,
        };
    }
  });
}
