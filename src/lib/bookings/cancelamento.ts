import { janelaDaSala } from "@/lib/video/sala";

/**
 * Quem pode cancelar, até quando, e o que acontece com a ficha (F7).
 *
 * Pura, e usada dos dois lados: a tela decide por ela se mostra "Cancelar" e o
 * que dizer antes do segundo clique; a transação decide por ela o que escrever,
 * com a sessão travada. Mesmo desenho de `avaliarAgenda`: o que a tela promete e
 * o que o banco faz saem da mesma função.
 *
 * As regras, decididas em 29/09/2026:
 *
 * - **Até a sala abrir** (início − 10 min). Depois disso já pode haver alguém
 *   dentro, e quem não vier é falta — a presença resolve. Nenhuma sala do Daily
 *   fica aberta para sessão cancelada, porque a sala só nasce dentro da janela.
 * - **O Profissional** cancela pedido pendente sempre com a ficha de volta, e
 *   sessão confirmada com a ficha de volta até `cancel_window_hours` antes do
 *   início. Depois do prazo ainda pode cancelar — o horário volta para a agenda
 *   do Parceiro —, mas a ficha conta como usada, como na falta.
 * - **O Parceiro** cancela sessão confirmada, e a ficha volta sempre. Dentro do
 *   prazo o Profissional ganha também a compensação da falta do Parceiro
 *   (`partner_no_show_bonus`): cancelar em cima da hora é falta avisada. Pedido
 *   pendente o Parceiro não cancela — recusa, que é a mesma coisa com outro nome.
 */

export type LadoDoCancelamento = "professional" | "partner";

export type MotivoDaRecusa =
  /** Já cancelada, recusada, expirada ou encerrada. */
  | "status"
  /** A sala já abriu: quem não vier é falta. */
  | "sala-aberta"
  /** O Parceiro diante de pedido pendente: é recusa, não cancelamento. */
  | "pedido";

export type Veredito =
  | { pode: false; motivo: MotivoDaRecusa }
  | { pode: true; estorna: boolean; compensa: boolean };

export type SessaoParaCancelar = {
  status: string;
  inicio: Date;
  fim: Date;
};

const HORA = 3_600_000;

/** Até quando o cancelamento devolve a ficha (e, do lado do Parceiro, não compensa). */
export function limiteDoEstorno(inicio: Date, janelaHoras: number): Date {
  return new Date(inicio.getTime() - janelaHoras * HORA);
}

export function regraDoCancelamento(
  sessao: SessaoParaCancelar,
  lado: LadoDoCancelamento,
  agora: Date,
  janelaHoras: number,
): Veredito {
  if (sessao.status !== "pending" && sessao.status !== "confirmed") {
    return { pode: false, motivo: "status" };
  }
  if (agora.getTime() >= janelaDaSala(sessao.inicio, sessao.fim).abre.getTime()) {
    return { pode: false, motivo: "sala-aberta" };
  }

  const aTempo = agora.getTime() < limiteDoEstorno(sessao.inicio, janelaHoras).getTime();

  if (lado === "partner") {
    if (sessao.status === "pending") return { pode: false, motivo: "pedido" };
    return { pode: true, estorna: true, compensa: !aTempo };
  }

  if (sessao.status === "pending") return { pode: true, estorna: true, compensa: false };
  return { pode: true, estorna: aTempo, compensa: false };
}

/** A frase de cada recusa, para o erro que a rota devolve. */
export function fraseDaRecusa(motivo: MotivoDaRecusa, status: string): string {
  if (motivo === "sala-aberta") {
    return "A sala já abriu. A partir daqui não dá mais para cancelar — quem não entrar conta como falta.";
  }
  if (motivo === "pedido") return "Esse pedido ainda espera sua resposta. Para não atender, recuse.";
  if (status === "cancelled") return "Essa sessão já foi cancelada.";
  if (status === "expired") return "Esse pedido expirou, e a ficha já voltou.";
  return "Essa sessão já foi encerrada.";
}
