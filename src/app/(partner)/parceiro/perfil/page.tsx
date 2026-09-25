import { PerfilForm } from "@/components/parceiro/PerfilForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { Tag } from "@/components/ui/Tag";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { carregarPerfil } from "@/lib/parceiro/dados";
import { cap } from "@/lib/terms";

/**
 * O perfil do Parceiro, com a prévia de como ele aparece na busca ao lado.
 *
 * A prévia existe porque a chamada e as áreas são o que decide se alguém clica,
 * e escrevê-las num formulário sem ver o resultado é escrever no escuro.
 */
export default async function Page() {
  const sessao = await requireRole("partner");
  const config = await loadAppConfig();
  const t = config.terms;

  const perfil = await carregarPerfil(sessao.userId);
  if (perfil === null) {
    return (
      <>
        <PageHeader eyebrow={t.partner} title="Meu perfil" />
        <EmptyState
          title="Seu cadastro ainda não está completo"
          description="Fale com quem administra a plataforma."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t.partner}
        title="Meu perfil"
        description={`É isto que o ${t.professional.toLowerCase()} vê antes de escolher você.`}
        actions={
          <Pill variant={CORES[perfil.status] ?? "neutral"}>
            {ROTULOS[perfil.status] ?? perfil.status}
          </Pill>
        }
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.3fr_1fr]">
        <Card title="Seus dados" icone="pencil">
          <PerfilForm perfil={perfil} expiraEmHoras={config.limits.pendingExpiresHours} />
        </Card>

        <div className="flex flex-col gap-[18px]">
          <Card title="Como você aparece" icone="user">
            <div className="flex items-start gap-3.5">
              <Avatar name={perfil.nome} size="lg" />
              <div className="min-w-0">
                <div className="font-display text-[24px] font-bold leading-[1.05]">
                  {perfil.nome || "Sem nome"}
                </div>
                <p className="mt-0.5 text-[13.5px] text-[#8E7C86]">
                  {perfil.headline ?? "Sem chamada — escreva uma linha ao lado."}
                </p>
                {perfil.areas.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {perfil.areas.map((area) => (
                      <Tag key={area}>{area}</Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {perfil.bio !== null && (
              <p className="mt-4 whitespace-pre-line border-t border-[#F3E4EC] pt-4 text-[13.5px] leading-[1.55] text-[#6E5F68]">
                {perfil.bio}
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3.5">
            <Stat value={perfil.sessoes} label={cap(t.sessions)} icone="calendar" />
            <Stat value={`${perfil.bufferMin}min`} label="Descanso" icone="clock" />
          </div>

          <Card title="O que só a operadora muda" icone="shield">
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <Linha rotulo="Situação" valor={ROTULOS[perfil.status] ?? perfil.status} />
              <Linha rotulo="Vínculo" valor={VINCULOS[perfil.engajamento] ?? perfil.engajamento} />
              <Linha rotulo="E-mail" valor={perfil.email} mono />
            </dl>
            <p className="mt-3 text-[12px] leading-[1.45] text-[#8E7C86]">
              Sua situação não é editável aqui — quem aprova {t.partner} é a operadora, e o banco
              recusa a mudança mesmo que o campo existisse.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor, mono = false }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[#F3E4EC] pt-2.5 first:border-t-0 first:pt-0">
      <dt className="shrink-0 text-[#8E7C86]">{rotulo}</dt>
      <dd className={`truncate text-right ${mono ? "font-mono text-[12px]" : ""}`}>{valor}</dd>
    </div>
  );
}

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
