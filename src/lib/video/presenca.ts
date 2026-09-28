import type { Reuniao } from "./daily";

/**
 * Presença derivada da sala (invariante 18), pura.
 *
 * O fechamento lê `/meetings` no Daily e passa o resultado por aqui. Nada disto
 * sabe de banco ou de rede: a decisão que move dinheiro — `no_show_partner`
 * estorna e compensa — fica testável com a lista de entradas na mão.
 */

export type EntradaNaSala = {
  /** O `user_id` do token, que é `profiles.id`. Nulo se alguém entrou sem ele. */
  userId: string | null;
  participantId: string;
  reuniaoId: string;
  entrou: Date;
  saiu: Date;
};

export function entradasDasReunioes(reunioes: readonly Reuniao[]): EntradaNaSala[] {
  return reunioes
    .flatMap((r) =>
      r.participants.map((p) => ({
        userId: p.user_id,
        participantId: p.participant_id,
        reuniaoId: r.id,
        entrou: new Date(p.join_time * 1000),
        saiu: new Date((p.join_time + p.duration) * 1000),
      })),
    )
    .sort((a, b) => a.entrou.getTime() - b.entrou.getTime());
}

/**
 * Esteve na sala durante a sessão marcada?
 *
 * Conta a entrada que cruza `[inicio, fim)`. Quem entrou às 8h52 para testar a
 * câmera e saiu antes das 9h não compareceu; quem entrou às 9h10 e ficou,
 * compareceu. Os cinco minutos de tolerância depois do fim não contam: entrar
 * quando a sessão já acabou não é ter participado dela.
 */
export function compareceu(
  entradas: readonly EntradaNaSala[],
  userId: string,
  inicio: Date,
  fim: Date,
): boolean {
  return entradas.some(
    (e) =>
      e.userId === userId &&
      e.entrou.getTime() < fim.getTime() &&
      e.saiu.getTime() > inicio.getTime(),
  );
}

export type Desfecho = "done" | "no_show_professional" | "no_show_partner";

/**
 * A máquina de estados do CLAUDE.md, ramo da sessão confirmada que terminou:
 * os dois entraram → `done`; só o Profissional → `no_show_partner` (estorno e
 * compensação); só o Parceiro, ou ninguém → `no_show_professional` (a ficha foi
 * usada).
 */
export function desfecho(presenca: { parceiro: boolean; profissional: boolean }): Desfecho {
  if (presenca.parceiro && presenca.profissional) return "done";
  if (presenca.profissional) return "no_show_partner";
  return "no_show_professional";
}
