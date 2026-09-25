import { NovoParceiroForm } from "@/components/admin/NovoParceiroForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { listarParceiros } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadTerms } from "@/lib/config/load";

/**
 * A curadoria dos Parceiros de Desenvolvimento.
 *
 * Invariante 9: eles pertencem à plataforma, não a uma empresa — a lista não
 * tem coluna de empresa porque não há uma, e o mesmo Parceiro atende gente de
 * todas as contratantes.
 */
export default async function Page() {
  const sessao = await requireRole("admin", "moderator");
  const t = await loadTerms();
  const parceiros = await listarParceiros();

  const ehOperadora = sessao.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title={t.partners}
        description={`${t.partnerLong} pertence à plataforma e atende ${t.professionals.toLowerCase()} de todas as ${t.orgs.toLowerCase()} contratantes. Ninguém se autocadastra — quem entra, entra por aqui.`}
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <Card
          title={`${parceiros.length} ${parceiros.length === 1 ? t.partner : t.partners}`}
          action={
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
              Escopo plataforma
            </span>
          }
        >
          {parceiros.length === 0 ? (
            <EmptyState
              title={`Nenhum ${t.partner} ainda`}
              description={
                ehOperadora
                  ? "Crie o primeiro ao lado. Ele nasce ativo e visível a todas as empresas."
                  : "A operadora ainda não convidou ninguém."
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.partner}</Th>
                  <Th>Áreas</Th>
                  <Th>Vínculo</Th>
                  <Th align="right">{t.sessions}</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {parceiros.map((parceiro) => (
                  <tr key={parceiro.id} className="transition-colors hover:bg-[#FDF8FB]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={parceiro.nome} size="sm" />
                        <CellStack
                          title={parceiro.nome}
                          sub={parceiro.headline ?? parceiro.email}
                        />
                      </div>
                    </Td>
                    <Td>
                      {parceiro.areas.length === 0 ? (
                        <span className="text-[12px] text-[#8E7C86]">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {parceiro.areas.map((area) => (
                            <Tag key={area}>{area}</Tag>
                          ))}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-[12.5px] text-[#8E7C86]">
                        {vinculo(parceiro.engajamento)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono tabular-nums">{parceiro.sessoes}</span>
                    </Td>
                    <Td>
                      <Pill variant={CORES[parceiro.status] ?? "neutral"}>
                        {ROTULOS[parceiro.status] ?? parceiro.status}
                      </Pill>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {ehOperadora ? (
          <Card title={`Novo ${t.partner}`}>
            <NovoParceiroForm termoParceiro={t.partner} />
          </Card>
        ) : (
          <Card title="Só leitura">
            <p className="text-[13px] leading-[1.5] text-[#8E7C86]">
              A moderação acompanha a lista e trata denúncias. Aprovar {t.partner} é da operadora.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

/**
 * Tradução do enum para a tela. Mapa e não `switch` porque o valor vem do banco
 * como texto: um status novo no enum aparece cru em vez de derrubar a página.
 */
const ROTULOS: Record<string, string> = {
  invited: "Convidado",
  onboarding: "Em cadastro",
  pending_review: "Em revisão",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

const CORES: Record<string, PillVariant> = {
  invited: "off",
  onboarding: "neutral",
  pending_review: "wait",
  active: "on",
  paused: "neutral",
  archived: "off",
};

const VINCULOS: Record<string, string> = {
  voluntario: "voluntário",
  parceria: "parceria",
  remunerado: "remunerado",
};

function vinculo(valor: string): string {
  return VINCULOS[valor] ?? valor;
}
