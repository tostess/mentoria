import type postgres from "postgres";
import { chaveAlocacaoManual } from "@/lib/ledger/keys";
import { alocacaoNaTransacao, compraNaTransacao, type Ator } from "@/lib/ledger/operacoes";
import {
  empresaNaTransacao,
  parceiroNaTransacao,
  profissionalNaTransacao,
} from "@/lib/pessoas/operacoes";
import type { DiaDaSemana } from "@/lib/scheduling";

/**
 * O cenário que os testes de banco montam — empresa, operadora, Profissional
 * com carteira, Parceiro com rotina.
 *
 * **Só testes usam este módulo.** Ele vive em `src/` e não ao lado de um `.test`
 * porque três suítes precisam do mesmo cenário (livro-caixa, recarga mensal,
 * reserva), e a alternativa era a terceira cópia dos mesmos seeds — com a
 * terceira chance de elas divergirem em silêncio e passarem a testar coisas
 * diferentes acreditando testar a mesma.
 *
 * O nome do arquivo é o aviso: nada de produção importa daqui. O que garante isso
 * é `cenario.test.ts`, que varre o código à procura de quem importe.
 *
 * Duas regras de desenho, herdadas de `ledger/transacoes.test.ts`:
 *
 * 1. **Os seeds passam pelas funções reais da aplicação.** `org_wallets` e
 *    `wallets` nascem do jeito que nascem em produção; um `insert` à mão
 *    produziria um cenário que o produto não consegue criar.
 * 2. **Tudo dentro de uma transação que sofre rollback.** É o que permite testar
 *    livro-caixa append-only: `rollback` não é `delete`, então o trigger de
 *    imutabilidade nem é consultado.
 */

/** Executa dentro de uma transação e desfaz tudo no fim. */
export async function inRollback<T>(
  db: postgres.Sql,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const sentinela = Symbol("rollback");
  try {
    return await db.begin(async (tx) => {
      const out = await fn(tx);
      // Abortar de propósito: nada deste teste pode sobreviver.
      throw Object.assign(new Error("rollback"), { sentinela, out });
    });
  } catch (erro) {
    if (erro && typeof erro === "object" && "sentinela" in erro && erro.sentinela === sentinela) {
      return (erro as unknown as { out: T }).out;
    }
    throw erro;
  }
}

let contador = 0;

/** Token no formato que `keys.ts` aceita, diferente a cada chamada. */
export function token(): string {
  contador += 1;
  return `${Date.now().toString(36)}-teste-${contador}`;
}

export async function identidade(tx: postgres.TransactionSql, prefixo: string): Promise<string> {
  contador += 1;
  const [user] = await tx<{ id: string }[]>`
    insert into auth.users (id, instance_id, aud, role, email)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', ${`${prefixo}-${Date.now()}-${contador}@teste.local`})
    returning id`;
  return user.id;
}

export type Operadora = { id: string; role: "admin" };

export async function operadora(tx: postgres.TransactionSql): Promise<Operadora> {
  const id = await identidade(tx, "adm");
  await tx`
    insert into profiles (id, role, name, email)
    values (${id}, 'admin', 'Operadora de Teste', ${`adm-${id}@teste.local`})`;
  return { id, role: "admin" };
}

export async function empresa(
  tx: postgres.TransactionSql,
  ator: Ator,
  nome = "Empresa de Teste",
): Promise<string> {
  const { id } = await empresaNaTransacao(tx, {
    nome,
    cnpj: "12345678000190",
    inicio: "2026-09-01",
    fim: "2027-08-31",
    accent: null,
    ator,
  });
  return id;
}

export async function profissional(
  tx: postgres.TransactionSql,
  orgId: string,
  ator: Ator,
  nome = "Pro Teste",
): Promise<string> {
  const userId = await identidade(tx, "pro");
  await profissionalNaTransacao(tx, userId, {
    orgId,
    nome,
    email: `pro-${userId}@teste.local`,
    cargo: "Coordenador",
    area: null,
    ator,
  });
  return userId;
}

export type RotinaDeTeste = {
  diaDaSemana: DiaDaSemana;
  inicioMin: number;
  fimMin: number;
};

/**
 * Parceiro ativo com rotina semanal — o que a reserva precisa para existir.
 *
 * `buffer_min` e `auto_confirm` vêm por `update` depois do insert porque
 * `parceiroNaTransacao` não os recebe: no produto quem os define é o próprio
 * Parceiro, na tela de perfil, e não quem o cria.
 */
export async function parceiroComRotina(
  tx: postgres.TransactionSql,
  ator: Ator,
  opcoes: {
    regras?: RotinaDeTeste[];
    fuso?: string;
    bufferMin?: number;
    maxPorSemana?: number;
    autoConfirm?: boolean;
    status?: string;
    nome?: string;
  } = {},
): Promise<string> {
  const userId = await identidade(tx, "par");

  await parceiroNaTransacao(tx, userId, {
    nome: opcoes.nome ?? "Parceiro de Teste",
    email: `par-${userId}@teste.local`,
    headline: "Liderança",
    bio: null,
    areas: ["Liderança"],
    engajamento: "voluntario",
    maxPorSemana: opcoes.maxPorSemana ?? 4,
    fuso: opcoes.fuso ?? "America/Sao_Paulo",
    ator,
  });

  await tx`
    update partners
       set buffer_min = ${opcoes.bufferMin ?? 15},
           auto_confirm = ${opcoes.autoConfirm ?? false},
           status = ${opcoes.status ?? "active"}::partner_status
     where id = ${userId}`;

  for (const regra of opcoes.regras ?? []) {
    await tx`
      insert into partner_rules (partner_id, weekday, start_min, end_min)
      values (${userId}, ${regra.diaDaSemana}, ${regra.inicioMin}, ${regra.fimMin})`;
  }

  return userId;
}

/** Contrato comprado e fichas na carteira, pelo caminho real da aplicação. */
export async function darFichas(
  tx: postgres.TransactionSql,
  {
    orgId,
    userId,
    ator,
    contrato,
    naCarteira,
    teto = 6,
  }: {
    orgId: string;
    userId: string;
    ator: Ator;
    contrato: number;
    naCarteira: number;
    teto?: number;
  },
): Promise<void> {
  await compraNaTransacao(tx, {
    orgId,
    fichas: contrato,
    referencia: "Contrato de teste",
    token: token(),
    ator,
  });

  if (naCarteira > 0) {
    await alocacaoNaTransacao(tx, {
      orgId,
      userId,
      quantidade: naCarteira,
      tetoCarteira: teto,
      chave: chaveAlocacaoManual(userId, token()),
      ator,
    });
  }
}
