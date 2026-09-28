import { PageHeader } from "@/components/shell/PageHeader";
import { BuscaDeParceiros, type CartaoDeParceiro } from "@/components/profissional/BuscaDeParceiros";
import { requireRole } from "@/lib/auth/session";
import { primeiroHorarioDeCada } from "@/lib/bookings";
import { loadAppConfig } from "@/lib/config/load";
import { DURACAO_DA_SESSAO_MIN } from "@/lib/config/limites";
import { diaEHora } from "@/lib/formato";
import { carregarFuso, listarParceirosAtivos } from "@/lib/profissional/dados";
import { countFichas } from "@/lib/terms";

export const metadata = { title: "Parceiros" };

/**
 * A busca do Profissional.
 *
 * A lista vem pela RLS (ativos são abertos a qualquer autenticado); o primeiro
 * horário de cada um vem do motor, pela mesma leitura que a reserva usa, e é
 * formatado aqui no fuso do Profissional — o cliente só filtra.
 */
export default async function Page() {
  const sessao = await requireRole("professional");
  const config = await loadAppConfig();
  const t = config.terms;

  const fuso = await carregarFuso(sessao.userId);
  const parceiros = await listarParceirosAtivos();
  const agora = new Date();
  const primeiros = await primeiroHorarioDeCada(
    parceiros.map((p) => p.id),
    agora,
    config,
  );

  const cartoes: CartaoDeParceiro[] = parceiros.map((p) => {
    const primeiro = primeiros.get(p.id) ?? null;
    return {
      id: p.id,
      nome: p.nome,
      foto: p.foto,
      chamada: p.chamada,
      areas: p.areas,
      textoDeBusca: [p.nome, p.chamada ?? "", ...p.areas, ...p.habilidades].join(" "),
      proximo: primeiro ? diaEHora(primeiro, fuso) : null,
      ordem: primeiro ? primeiro.getTime() : Number.MAX_SAFE_INTEGER,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow={t.professional}
        title={t.partners}
        description={`Os ${t.partners} atendem profissionais de todas as empresas. Cada ${t.session} dura ${DURACAO_DA_SESSAO_MIN} minutos e custa ${countFichas(config.fichaPolicy.price30, t)}.`}
      />
      <BuscaDeParceiros
        parceiros={cartoes}
        termoPlural={t.partners}
        horizonteDias={config.limits.bookingHorizonDays}
      />
    </>
  );
}
