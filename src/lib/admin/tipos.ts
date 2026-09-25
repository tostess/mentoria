/**
 * Formas das linhas que as listas do painel recebem.
 *
 * Moram fora de `consultas.ts` porque as tabelas com busca são componentes de
 * cliente, e componente de cliente não importa nada de módulo `server-only` —
 * nem tipo: o teste da invariante 5 lê o `from`, não a palavra `type`.
 */

export type Colaborador = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  ativo: boolean;
  saldo: number;
  ultimoUso: Date | null;
};

export type ParceiroNaLista = {
  id: string;
  nome: string;
  email: string;
  headline: string | null;
  status: string;
  engajamento: string;
  areas: string[];
  sessoes: number;
  maxPorSemana: number;
};
