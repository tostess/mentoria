import type { Metadata } from "next";
import Link from "next/link";
import { FeedDeAtividade } from "@/components/admin/FeedDeAtividade";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ACOES_AUDITADAS, ehAcaoConhecida, rotuloDaAcao } from "@/lib/admin/atividade";
import { listarAtividade } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadTerms } from "@/lib/config/load";

export const metadata: Metadata = { title: "Atividade" };

const LIMITE = 100;

/**
 * Tudo o que a operadora decidiu, mais recente primeiro — invariante 12 com
 * cara de gente. O filtro por tipo vive na URL, e não em estado de cliente,
 * para que "todas as alocações" seja um endereço que se manda para alguém.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  await requireRole("admin", "moderator");
  const t = await loadTerms();
  const { tipo } = await searchParams;
  const filtro = typeof tipo === "string" && ehAcaoConhecida(tipo) ? tipo : null;

  const eventos = await listarAtividade({ acao: filtro, limite: LIMITE });

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title="Atividade"
        description="Cada decisão da operadora fica registrada com quem tomou e quando. Não se edita nem se apaga."
      />

      <Card
        title={filtro === null ? "Todas as decisões" : rotuloDaAcao(filtro, t)}
        icone="history"
        action={
          eventos.length === LIMITE ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
              Últimas {LIMITE}
            </span>
          ) : undefined
        }
      >
        <nav aria-label="Filtrar por tipo" className="mb-4 flex flex-wrap gap-1.5">
          <ChipLink href="/admin/atividade" ativo={filtro === null}>
            Todas
          </ChipLink>
          {ACOES_AUDITADAS.map((acao) => (
            <ChipLink key={acao} href={`/admin/atividade?tipo=${acao}`} ativo={filtro === acao}>
              {rotuloDaAcao(acao, t)}
            </ChipLink>
          ))}
        </nav>

        {eventos.length === 0 ? (
          <EmptyState
            icone="history"
            title="Nada por aqui"
            description={
              filtro === null
                ? "Nenhuma decisão registrada ainda."
                : "Nenhuma decisão deste tipo ainda."
            }
          />
        ) : (
          <FeedDeAtividade eventos={eventos} t={t} />
        )}
      </Card>
    </>
  );
}

function ChipLink({
  href,
  ativo,
  children,
}: {
  href: string;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-[8px] border px-[11px] py-[6px] text-[12.5px] transition-colors ${
        ativo
          ? "border-transparent bg-[#FCEDF4] font-semibold text-[#8E1E58]"
          : "border-[#EAD6E1] bg-white text-[#8E7C86] hover:text-[#2A1B26]"
      }`}
    >
      {children}
    </Link>
  );
}
