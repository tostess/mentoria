import type { Metadata } from "next";
import { NovoParceiroForm } from "@/components/admin/NovoParceiroForm";
import { ParceirosTabela } from "@/components/admin/ParceirosTabela";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { listarParceiros } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadTerms } from "@/lib/config/load";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await loadTerms()).partners };
}

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
          icone="handshake"
          action={
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86] sm:inline">
              Atendem todas as {t.orgs.toLowerCase()}
            </span>
          }
        >
          {parceiros.length === 0 ? (
            <EmptyState
              icone="user-plus"
              title={`Nenhum ${t.partner} ainda`}
              description={
                ehOperadora
                  ? "Crie o primeiro ao lado. Ele nasce ativo e visível a todas as empresas."
                  : "A operadora ainda não convidou ninguém."
              }
            />
          ) : (
            <ParceirosTabela parceiros={parceiros} />
          )}
        </Card>

        {ehOperadora ? (
          <Card title={`Novo ${t.partner}`} icone="user-plus">
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
