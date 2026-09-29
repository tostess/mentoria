import type { ReactNode } from "react";
import type { SessaoNaAgenda } from "@/lib/bookings/agenda";
import {
  limiteDoEstorno,
  regraDoCancelamento,
  type LadoDoCancelamento,
} from "@/lib/bookings/cancelamento";
import { diaEHora } from "@/lib/formato";
import { countFichas, type Terms } from "@/lib/terms";
import { CancelarSessao } from "./CancelarSessao";

export type PoliticaDoCancelamento = {
  /** `cancel_window_hours`. */
  janelaHoras: number;
  /** `partner_no_show_bonus`. */
  compensacao: number;
};

/**
 * O "Cancelar" de uma sessão da agenda, com a frase certa para o lado de quem
 * olha e para o prazo em que se está — ou nada, quando não dá mais para
 * cancelar (a sala abriu, ou é pedido pendente na mão do Parceiro, que tem
 * "Recusar").
 *
 * Função e não componente, como `botaoDaSala`: quem chama precisa saber se há
 * oferta para montar o detalhe da linha. Formata no servidor, no fuso de quem
 * olha, sem levar o luxon para o bundle.
 */
export function ofertaDeCancelamento(
  s: SessaoNaAgenda,
  lado: LadoDoCancelamento,
  agora: Date,
  politica: PoliticaDoCancelamento,
  t: Terms,
  fuso: string,
): ReactNode | undefined {
  const veredito = regraDoCancelamento(s, lado, agora, politica.janelaHoras);
  if (!veredito.pode) return undefined;

  const nome = s.outro.nome.split(/\s+/)[0] || s.outro.nome;
  const limite = diaEHora(limiteDoEstorno(s.inicio, politica.janelaHoras), fuso);
  const horas = politica.janelaHoras;
  const esperado = { estorna: veredito.estorna, compensa: veredito.compensa };

  let pergunta: string;
  let confirmar: string;
  let prazo: string | undefined;

  if (lado === "professional") {
    if (s.status === "pending") {
      pergunta = `Cancelar o pedido para ${nome}? A ${t.ficha} volta para você agora.`;
      confirmar = "Cancelar pedido";
    } else if (veredito.estorna) {
      pergunta = `Cancelar a ${t.session} com ${nome}? A ${t.ficha} volta para você, e o horário fica livre para outra pessoa.`;
      confirmar = `Cancelar ${t.session}`;
      prazo = `com a ${t.ficha} de volta até ${limite}`;
    } else {
      pergunta = `Faltam menos de ${horas} horas. Se cancelar agora, a ${t.ficha} não volta — conta como usada. O horário fica livre para outra pessoa.`;
      confirmar = "Cancelar mesmo assim";
      prazo = `a ${t.ficha} não volta mais`;
    }
  } else if (veredito.compensa) {
    const extra = politica.compensacao > 0 ? `, com mais ${countFichas(politica.compensacao, t)} pelo transtorno` : "";
    pergunta = `Faltam menos de ${horas} horas: cancelar agora conta como falta avisada. A ${t.ficha} volta para ${nome}${extra}.`;
    confirmar = "Cancelar mesmo assim";
    prazo = "agora conta como falta avisada";
  } else {
    pergunta = `Cancelar a ${t.session} com ${nome}? A ${t.ficha} volta para ${nome} agora e o horário reabre na sua agenda.`;
    confirmar = `Cancelar ${t.session}`;
    prazo = politica.compensacao > 0 ? `sem compensação até ${limite}` : undefined;
  }

  return (
    <CancelarSessao
      bookingId={s.id}
      pergunta={pergunta}
      confirmar={confirmar}
      prazo={prazo}
      esperado={esperado}
    />
  );
}

/** Frase de cima e oferta de cancelar, uma embaixo da outra; some o que faltar. */
export function juntar(frase: ReactNode, oferta: ReactNode): ReactNode {
  if (!oferta) return frase;
  if (!frase) return oferta;
  return (
    <span className="flex flex-col items-start gap-1">
      {frase}
      {oferta}
    </span>
  );
}
