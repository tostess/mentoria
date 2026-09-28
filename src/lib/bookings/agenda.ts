/**
 * A sessão como as duas agendas a mostram, depois de lida pela RLS.
 *
 * `outro` é a pessoa do outro lado: o Parceiro na agenda do Profissional, o
 * Profissional na do Parceiro. Cargo e empresa só existem no segundo caso — é o
 * que a view `partner_professionals` entrega, e nada além disso.
 *
 * Módulo puro: sem banco, sem `server-only`.
 */

export type PessoaDaSessao = {
  id: string;
  nome: string;
  foto: string | null;
  cargo: string | null;
  empresa: string | null;
};

export type SessaoNaAgenda = {
  id: string;
  inicio: Date;
  fim: Date;
  status: string;
  criadaEm: Date;
  /** `cancelled_by` é o Parceiro: na P4, a única forma de cancelar é recusar. */
  recusadaPeloParceiro: boolean;
  outro: PessoaDaSessao;
};

/**
 * Próximas (pendentes e confirmadas que ainda não terminaram), da mais cedo
 * para a mais tarde; anteriores, da mais recente para a mais antiga.
 *
 * Confirmada cujo fim já passou fica em "anteriores" mesmo antes de o
 * `close-sessions` rodar — a tela não espera o cron para dizer a verdade.
 */
export function separarAgenda(
  sessoes: SessaoNaAgenda[],
  agora: Date,
): { pedidos: SessaoNaAgenda[]; proximas: SessaoNaAgenda[]; anteriores: SessaoNaAgenda[] } {
  const t = agora.getTime();
  const futura = (s: SessaoNaAgenda) => s.fim.getTime() > t;
  const pedidos = sessoes
    .filter((s) => s.status === "pending" && s.inicio.getTime() > t)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const proximas = sessoes
    .filter((s) => s.status === "confirmed" && futura(s))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const anteriores = sessoes
    .filter((s) => !pedidos.includes(s) && !proximas.includes(s))
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
  return { pedidos, proximas, anteriores };
}

/**
 * Até quando o Parceiro pode responder a um pedido: o prazo de
 * `pending_expires_hours` ou o início da sessão, o que vier primeiro — a mesma
 * regra com que o `expire-pending` decide expirar.
 */
export function limiteDeResposta(s: Pick<SessaoNaAgenda, "criadaEm" | "inicio">, horas: number): Date {
  const prazo = s.criadaEm.getTime() + horas * 3_600_000;
  return new Date(Math.min(prazo, s.inicio.getTime()));
}
