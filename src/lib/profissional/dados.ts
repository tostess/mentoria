import "server-only";

import { createClient } from "@/lib/supabase/server";
import { rotuloDoLancamento } from "@/lib/ledger/rotulos";
import type { NomeIcone } from "@/components/ui/icones";

/**
 * A carteira do Profissional, lida **pelo cliente da sessão dele**.
 *
 * Nem Drizzle nem `service_role`. A Etapa 3 deu a `wallets` e a `wallet_ledger`
 * policy de `select` do próprio `user_id` e **nenhuma** de escrita (invariante
 * 4), então ler por aqui é ler exatamente o que a policy permite: se ela
 * estivesse frouxa, a tela mostraria carteira alheia e o defeito apareceria na
 * hora, em vez de dormir até alguém procurar.
 *
 * De quebra evita o travamento: estas consultas vão por HTTP ao PostgREST, não
 * pela conexão Drizzle de `max: 1` que não tolera consulta concorrente. É o
 * mesmo motivo documentado em `lib/parceiro/dados.ts`, e é o que permite o saldo
 * ser lido no layout enquanto a página faz o dela.
 *
 * O preço é que a resposta do supabase-js não é tipada pelo esquema, então cada
 * linha é validada aqui antes de virar tipo da aplicação.
 */

export type Carteira = {
  saldo: number;
  /** Último lançamento negativo — o que alimenta o `nudge-idle`. */
  ultimoUso: Date | null;
  ultimaEntrada: Date | null;
};

export type LancamentoDaCarteira = {
  id: string;
  tipo: string;
  rotulo: string;
  icone: NomeIcone;
  /** Positivo entrou, negativo saiu. */
  quantidade: number;
  saldoDepois: number;
  motivo: string | null;
  quando: Date;
};

function inteiro(valor: unknown, padrao: number): number {
  return typeof valor === "number" && Number.isInteger(valor) ? valor : padrao;
}

function data(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

/**
 * Devolve `null` quando não há carteira — e isso não é erro.
 *
 * O Profissional é criado com carteira, mas a conta pode existir sem ela num
 * banco em que alguém mexeu à mão. A tela diz "fale com o RH" em vez de estourar.
 */
export async function carregarCarteira(userId: string): Promise<Carteira | null> {
  const supabase = await createClient();
  const { data: linha, error } = await supabase
    .from("wallets")
    .select("balance, last_used_at, last_entry_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) throw new Error(`carteira: ${error.message}`);
  if (linha === null) return null;

  const w = linha as Record<string, unknown>;
  return {
    saldo: inteiro(w.balance, 0),
    ultimoUso: data(w.last_used_at),
    ultimaEntrada: data(w.last_entry_at),
  };
}

/**
 * O extrato, do mais novo para o mais velho.
 *
 * Sem o nome de quem lançou, de propósito: quem aloca é a operadora ou o RH, e a
 * policy de `profiles` não deixa o Profissional ler o perfil de quem não é da
 * empresa dele nem Parceiro ativo (invariante 9). Tentar mostrar o nome daria
 * uma coluna vazia e a impressão de defeito. O que importa aqui é o movimento da
 * ficha; de quem partiu é assunto do livro-caixa da empresa.
 */
export async function carregarExtrato(
  userId: string,
  limite = 20,
): Promise<LancamentoDaCarteira[]> {
  const supabase = await createClient();
  const { data: linhas, error } = await supabase
    .from("wallet_ledger")
    .select("id, type, amount, balance_after, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error !== null) throw new Error(`extrato: ${error.message}`);

  return (linhas ?? [])
    .map((linha) => linha as Record<string, unknown>)
    .filter((l) => typeof l.id === "string" && typeof l.type === "string")
    .map((l) => {
      const { rotulo, icone } = rotuloDoLancamento(l.type as string);
      return {
        id: l.id as string,
        tipo: l.type as string,
        rotulo,
        icone,
        quantidade: inteiro(l.amount, 0),
        saldoDepois: inteiro(l.balance_after, 0),
        motivo: texto(l.reason),
        quando: data(l.created_at) ?? new Date(0),
      };
    });
}
