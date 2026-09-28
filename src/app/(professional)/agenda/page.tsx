import { LinhaDeSessao } from "@/components/agenda/LinhaDeSessao";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { requireRole } from "@/lib/auth/session";
import { limiteDeResposta, separarAgenda, type SessaoNaAgenda } from "@/lib/bookings/agenda";
import { loadAppConfig } from "@/lib/config/load";
import { diaEHora, rotuloDoFuso } from "@/lib/formato";
import { carregarAgendaDoProfissional, carregarFuso } from "@/lib/profissional/dados";
import type { Terms } from "@/lib/terms";

export const metadata = { title: "Minha agenda" };

/**
 * A agenda do Profissional, pela RLS de `bookings` (dono da sessão).
 *
 * Sem botão de desmarcar: cancelamento com estorno é F7, fora do piloto. O
 * estorno que já existe — recusa e expiração — é dito em frase, porque "e a
 * minha ficha?" é a pergunta que a pessoa faz ao ver o status.
 */
export default async function Page() {
  const sessao = await requireRole("professional");
  const config = await loadAppConfig();
  const t = config.terms;
  const fuso = await carregarFuso(sessao.userId);
  const agora = new Date();

  const agenda = await carregarAgendaDoProfissional(sessao.userId, t.partner);
  const { pedidos, proximas, anteriores } = separarAgenda(agenda, agora);
  const futuras = [...pedidos, ...proximas].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const horas = config.limits.pendingExpiresHours;

  return (
    <>
      <PageHeader
        eyebrow={t.professional}
        title="Minha agenda"
        description={`Horários no seu fuso (${rotuloDoFuso(fuso)}).`}
        actions={
          <ButtonLink href="/parceiros" variant="ghost">
            <Icone nome="search" tamanho={15} />
            {agenda.length === 0 ? `Encontrar um ${t.partner}` : "Marcar outra"}
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-[18px]">
          <Card title="Próximas">
            {futuras.length === 0 ? (
              <EmptyState
                icone="calendar"
                title={`Nenhuma ${t.session} marcada`}
                description={`Escolha um ${t.partner} e um horário — cada ${t.session} usa uma ${t.ficha}.`}
              />
            ) : (
              <ul className="flex flex-col">
                {futuras.map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    detalhe={
                      s.status === "pending"
                        ? `Aguardando ${primeiroNome(s)} até ${diaEHora(limiteDeResposta(s, horas), fuso)}.`
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </Card>

          {anteriores.length > 0 && (
            <Card title="Anteriores">
              <ul className="flex flex-col">
                {anteriores.map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    detalhe={detalheDoHistorico(s, t)}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Note icon={<Icone nome="info" tamanho={16} />}>
          A sala da {t.session} abre aqui, 10 minutos antes do horário, a partir da próxima etapa.
          Precisa desmarcar? Por enquanto, fale com a {t.admin.toLowerCase()} da plataforma.
        </Note>
      </div>
    </>
  );
}

function primeiroNome(s: SessaoNaAgenda): string {
  return s.outro.nome.split(/\s+/)[0] || s.outro.nome;
}

function detalheDoHistorico(s: SessaoNaAgenda, t: Terms): string | undefined {
  if (s.status === "cancelled" && s.recusadaPeloParceiro) {
    return `${primeiroNome(s)} não pôde atender. A ${t.ficha} voltou para você.`;
  }
  if (s.status === "expired") return `Sem resposta a tempo. A ${t.ficha} voltou para você.`;
  return undefined;
}
