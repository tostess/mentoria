import type { Metadata } from "next";
import { FilaDeCadastros, type PedidoParaDecidir } from "@/components/admin/FilaDeCadastros";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import { requireRole } from "@/lib/auth/session";
import { listarDecididos, listarPendentes } from "@/lib/cadastro/consultas";
import { loadTerms } from "@/lib/config/load";
import { dataHora, quandoRelativo } from "@/lib/formato";

export const metadata: Metadata = { title: "Cadastros" };

/**
 * A fila do cadastro self-service (A3): quem pediu uma conta pessoal em
 * `/cadastro` e espera a operadora. Aprovar abre a conta com o login que a
 * pessoa criou; recusar apaga o login e guarda o pedido, sem os dados, depois
 * de 90 dias.
 *
 * Selecionar e aprovar em lote, porque a fila enche em ondas — uma divulgação,
 * um evento — e decidir um por um seria o gargalo da operação.
 */
export default async function Page() {
  const sessao = await requireRole("admin", "moderator");
  const t = await loadTerms();
  const pendentes = await listarPendentes();
  const decididos = await listarDecididos();
  const agora = new Date();
  const podeDecidir = sessao.role === "admin";

  const pedidos: PedidoParaDecidir[] = pendentes.map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    detalhe: [p.cargo, p.area].filter(Boolean).join(" · ") || null,
    telefone: p.telefone,
    linkedin: p.linkedin,
    objetivo: p.objetivo,
    quando: quandoRelativo(p.pedidoEm, agora),
    quandoCompleto: dataHora(p.pedidoEm),
    emailConfirmado: p.emailConfirmado,
    temLogin: p.temLogin,
  }));

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title="Cadastros"
        description={`Pedidos de ${t.individual.toLowerCase()} feitos pela própria pessoa. Aprovar abre a conta com o e-mail e a senha do pedido; recusar apaga o login.`}
      />

      <div className="flex flex-col gap-[18px]">
        <Card
          title={
            pendentes.length === 0
              ? "Nenhum pedido esperando"
              : pendentes.length === 1
                ? "1 pedido esperando"
                : `${pendentes.length} pedidos esperando`
          }
          icone="inbox"
        >
          {/* Sempre montada, mesmo vazia: decidir o último pedido não pode levar embora a frase do que aconteceu. */}
          <FilaDeCadastros pedidos={pedidos} podeDecidir={podeDecidir} />
        </Card>

        {decididos.length > 0 && (
          <Card title="Decididos recentemente" icone="history">
            <Table>
              <thead>
                <tr>
                  <Th>Pessoa</Th>
                  <Th>Decisão</Th>
                  <Th>Por</Th>
                  <Th>Quando</Th>
                </tr>
              </thead>
              <tbody>
                {decididos.map((d) => (
                  <tr key={d.id}>
                    <Td>
                      <CellStack
                        title={d.anonimizado ? <span className="text-stone">{d.nome}</span> : d.nome}
                        sub={d.email ?? undefined}
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <Pill variant={d.aprovado ? "on" : "bad"}>{d.aprovado ? "Aprovado" : "Recusado"}</Pill>
                        {d.motivo !== null && (
                          <span className="max-w-[280px] text-[12px] leading-[1.4] text-stone">
                            {d.motivo}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-[13px]">{d.decididoPor ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-stone" title={dataHora(d.decididoEm)}>
                        {quandoRelativo(d.decididoEm, agora)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
