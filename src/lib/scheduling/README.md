# `src/lib/scheduling/` — motor de disponibilidade (F2)

INVARIANTE 1: **TypeScript puro**. Nenhum import de Firebase, nenhuma leitura de
rede, nenhum `Date.now()` escondido. Recebe dados (regras semanais, excecoes,
reservas existentes, duracao, buffer), devolve slots.

Depois de validada pela suite Vitest, esta pasta **fica travada** — mudanca aqui
so com pedido explicito e teste junto.

Regras de borda:

- Datas em UTC. A regra semanal do mentor chega no fuso dele, acompanhada do
  campo `timezone` IANA; a conversao usa Luxon e acontece aqui dentro, de forma
  determinista.
- O assistente de IA de matching (F11) recebe **apenas** slots ja validados por
  este motor. Ele nunca inventa horario.

Vazia de proposito: a F2 comeca escrevendo os testes.
