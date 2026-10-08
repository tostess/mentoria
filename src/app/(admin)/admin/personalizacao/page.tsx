import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import { listarMarcas } from "@/lib/admin/consultas";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { mergeBranding } from "@/lib/config/app-config";
import { resolveTheme, variaveisDoTema } from "@/lib/theme";

export const metadata: Metadata = { title: "Personalização" };

/**
 * A marca de cada empresa, lado a lado (F4b). A edição mora na tela da
 * empresa, no cartão "Marca"; aqui é o mapa, para a operadora ver quem já tem
 * marca própria sem abrir uma por uma.
 *
 * Cada amostra recebe as variáveis da marca daquela empresa no próprio
 * elemento e pinta com as classes de sempre — nenhum hex no componente.
 */
export default async function Page() {
  const sessao = await requireRole("admin", "moderator");
  const config = await loadAppConfig();
  const t = config.terms;
  const marcas = await listarMarcas();
  const ehOperadora = sessao.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow={t.admin}
        title="Personalização"
        description={`A marca que o ${t.orgAdmin} e os colaboradores de cada ${t.org.toLowerCase()} veem. A operadora, os ${t.partners} e as contas pessoais ficam com a marca da plataforma.`}
      />

      <Card title={`Marca por ${t.org.toLowerCase()}`} icone="palette">
        {marcas.length === 0 ? (
          <EmptyState
            icone="building"
            title={`Nenhuma ${t.org.toLowerCase()} ainda`}
            description={`A marca se escolhe na tela da ${t.org.toLowerCase()}, depois de criá-la.`}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.org}</Th>
                <Th>Cores</Th>
                <Th className="max-sm:hidden">Nome na marca</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {marcas.map((empresa) => {
                const tema = resolveTheme(
                  mergeBranding(config.branding, {
                    accent: empresa.marca.accent,
                    name: empresa.marca.nomeNaMarca,
                    logoUrl: empresa.marca.logotipo,
                    cores: empresa.marca.cores,
                  }),
                );
                const ajustadas = Object.keys(empresa.marca.cores).length;
                const propria = empresa.marca.accent !== null || ajustadas > 0;
                return (
                  <tr key={empresa.id} className="group relative transition-colors hover:bg-mist">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <CellStack
                          title={
                            <Link
                              href={`/admin/empresas/${empresa.id}#marca`}
                              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                            >
                              {empresa.nome}
                            </Link>
                          }
                        />
                        {!empresa.ativa && <Pill variant="off">Inativa</Pill>}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          style={variaveisDoTema(tema) as CSSProperties}
                          className="flex overflow-hidden rounded-[8px] border border-line"
                          aria-hidden
                        >
                          <span className="h-6 w-6 bg-accent" />
                          <span className="h-6 w-6 bg-deep" />
                          <span className="h-6 w-6 bg-blush" />
                          <span className="h-6 w-6 bg-mist" />
                        </span>
                        <CellStack
                          title={
                            <span className="font-mono text-[12px]">
                              {propria ? tema.accent : "Da plataforma"}
                            </span>
                          }
                          sub={
                            ajustadas === 0
                              ? "todas derivadas"
                              : ajustadas === 1
                                ? "1 cor ajustada"
                                : `${ajustadas} cores ajustadas`
                          }
                        />
                      </div>
                    </Td>
                    <Td className="max-sm:hidden">
                      <span className="text-[13px] text-stone">
                        {empresa.marca.nomeNaMarca ?? "—"}
                        {empresa.marca.logotipo !== null && " · com logotipo"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent">
                        <span className="max-sm:sr-only">{ehOperadora ? "Editar" : `Ver ${t.org.toLowerCase()}`}</span>
                        <Icone nome="chevron-right" tamanho={14} />
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
