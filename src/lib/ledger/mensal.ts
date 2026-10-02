import { DateTime } from "luxon";
import type postgres from "postgres";
import type { FichaPolicy } from "@/lib/config/app-config";
import { LancamentoRepetido, SaldoInsuficiente, TetoDaCarteira, comTraducao } from "./erros";
import { chaveAlocacaoMensal, periodo as periodoDe } from "./keys";
import { alocacaoNaTransacao } from "./operacoes";

/**
 * A recarga do dia 1º — `allocate-monthly`.
 *
 * Invariante 16: idempotente por `idempotency_key`. A chave é
 * `alloc_{userId}_{YYYYMM}`, então rodar duas vezes no mesmo mês colide na
 * segunda, e colidir **é** o resultado correto: significa que aquela pessoa já
 * recebeu. O cron pode ser disparado de novo à mão sem medo.
 *
 * Uma transação **por pessoa**, não uma para todas. Uma carteira no teto, um
 * contrato que acabou no meio da lista ou um dado corrompido de uma empresa não
 * podem impedir as outras de receber — e uma transação única de centenas de
 * lançamentos transformaria qualquer um desses casos numa rodada perdida.
 *
 * O preço é que a rodada pode parar no meio (queda de rede, timeout da função).
 * Isso é seguro justamente por causa da chave: a próxima execução retoma de onde
 * parou, porque quem já recebeu colide e quem não recebeu passa.
 *
 * Sem `server-only`, e recebendo a conexão em vez de abri-la: é o que deixa o
 * teste passar a **própria transação** como conexão. As transações por pessoa
 * viram savepoints dentro dela, e o rollback do teste desfaz a rodada inteira —
 * o mesmo truque que torna o livro-caixa append-only testável. Quem chama com a
 * conexão de verdade é `ledger/index.ts`.
 */

/**
 * Como a rodada fala com o banco.
 *
 * Duas peças porque são dois usos diferentes: `sql` serve as leituras, e
 * `emTransacao` abre **uma transação por pessoa**. A segunda é uma função e não
 * o próprio `sql` porque abrir transação tem nome diferente dependendo de onde
 * se está: na conexão é `begin`, dentro de outra transação é `savepoint`. O
 * teste passa `savepoint` e a rodada inteira cabe no rollback dele; a aplicação
 * passa `begin` e cada pessoa commita de verdade.
 */
export type Acesso = {
  sql: postgres.Sql | postgres.TransactionSql;
  emTransacao: <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) => Promise<T>;
};

type Conexao = postgres.Sql | postgres.TransactionSql;

/** Acesso de produção: cada pessoa numa transação própria, que commita. */
export function acessoDaConexao(sql: postgres.Sql): Acesso {
  return { sql, emTransacao: (fn) => sql.begin(fn) as ReturnType<typeof fn> };
}

/** Acesso de teste: savepoints dentro da transação que o teste vai desfazer. */
export function acessoDaTransacao(tx: postgres.TransactionSql): Acesso {
  return { sql: tx, emTransacao: (fn) => tx.savepoint(fn) as ReturnType<typeof fn> };
}

/** O fuso em que "o mês" é decidido — da recarga e da cota de presente. */
export const FUSO_DA_PLATAFORMA = "America/Sao_Paulo";

export type ResultadoPorEmpresa = {
  orgId: string;
  empresa: string;
  /** Quantas pessoas receberam ficha nesta rodada. */
  pessoas: number;
  /** Total de fichas movidas. */
  fichas: number;
  /** Já tinham recebido neste mês — segunda execução. */
  jaFeitas: number;
  /** Carteira no teto: não cabia nem uma. */
  noTeto: number;
  /** O contrato da empresa acabou antes de chegar a todos. */
  semSaldo: number;
  /** Falhas de verdade, com a mensagem. Não interrompem a rodada. */
  erros: string[];
};

export type ResultadoDaRecarga = {
  periodo: string;
  empresas: ResultadoPorEmpresa[];
  totalPessoas: number;
  totalFichas: number;
};

type Candidato = {
  userId: string;
  orgId: string;
  empresa: string;
  saldoCarteira: number;
};

/**
 * Quem recebe: Profissional ativo, não excluído, com carteira, de empresa ativa.
 *
 * "Selecionado pelo RH" equivale hoje a "foi cadastrado", porque a carteira nasce
 * junto do Profissional. Desativar a conta (`profiles.active = false`) já tira a
 * pessoa daqui — é o mesmo botão que tira o acesso dela.
 */
async function candidatos(sql: Conexao): Promise<Candidato[]> {
  const linhas = await sql<
    { user_id: string; org_id: string; empresa: string; saldo_carteira: number }[]
  >`
    select w.user_id, w.org_id, o.name as empresa, w.balance as saldo_carteira
      from wallets w
      join profiles p on p.id = w.user_id
      join orgs o on o.id = w.org_id
     where p.role = 'professional'
       and p.active
       and p.deleted_at is null
       and o.active
       -- A recarga sai do contrato da empresa. Conta pessoal não tem contrato:
       -- compra pacote.
       and o.kind = 'empresa'
     order by o.name, p.name`;

  return linhas.map((l) => ({
    userId: l.user_id,
    orgId: l.org_id,
    empresa: l.empresa,
    saldoCarteira: l.saldo_carteira,
  }));
}

async function saldoDoContrato(sql: Conexao, orgId: string): Promise<number> {
  const [linha] = await sql<{ balance: number }[]>`
    select balance from org_wallets where org_id = ${orgId}`;
  return linha?.balance ?? 0;
}

/**
 * Quanto dar a esta pessoa: o valor do mês, limitado pelo que cabe na carteira e
 * pelo que sobrou no contrato.
 *
 * Parcial de propósito. Quem está com 5 e tem teto 6 recebe 1, não zero — a
 * decisão é não deixar ficha na mesa por causa do teto. Zero significa "não cabe
 * nada", e aí o motivo importa: teto cheio é uma coisa, contrato vazio é outra.
 */
export function quantoAlocar(
  saldoCarteira: number,
  saldoContrato: number,
  policy: Pick<FichaPolicy, "defaultAllocationPerUser" | "maxBalance">,
): number {
  const cabeNaCarteira = Math.max(0, policy.maxBalance - saldoCarteira);
  return Math.max(0, Math.min(policy.defaultAllocationPerUser, cabeNaCarteira, saldoContrato));
}

export async function recargaNaConexao(
  acesso: Acesso,
  {
    agora,
    fichaPolicy,
  }: {
    /** Parâmetro, não `new Date()`: é o que deixa a rodada ser testável. */
    agora: Date;
    fichaPolicy: FichaPolicy;
  },
): Promise<ResultadoDaRecarga> {
  const local = DateTime.fromJSDate(agora, { zone: FUSO_DA_PLATAFORMA });
  const chavePeriodo = periodoDe(local.year, local.month);

  const porEmpresa = new Map<string, ResultadoPorEmpresa>();

  for (const candidato of await candidatos(acesso.sql)) {
    const resultado =
      porEmpresa.get(candidato.orgId) ??
      ({
        orgId: candidato.orgId,
        empresa: candidato.empresa,
        pessoas: 0,
        fichas: 0,
        jaFeitas: 0,
        noTeto: 0,
        semSaldo: 0,
        erros: [],
      } satisfies ResultadoPorEmpresa);
    porEmpresa.set(candidato.orgId, resultado);

    /**
     * O saldo do contrato é relido pessoa a pessoa, e não uma vez por empresa.
     * Cada alocação é a sua própria transação e commita, então um número lido no
     * começo da lista fica velho na terceira pessoa — e velho aqui significa
     * tentar alocar o que não existe e colher uma transação falhada onde cabia
     * um "pulei, contrato vazio".
     */
    const saldoContrato = await saldoDoContrato(acesso.sql, candidato.orgId);
    const quantidade = quantoAlocar(candidato.saldoCarteira, saldoContrato, fichaPolicy);

    if (quantidade === 0) {
      if (saldoContrato === 0) resultado.semSaldo += 1;
      else resultado.noTeto += 1;
      continue;
    }

    try {
      await comTraducao(
        () =>
          acesso.emTransacao((tx) =>
            alocacaoNaTransacao(tx, {
              orgId: candidato.orgId,
              userId: candidato.userId,
              quantidade,
              tetoCarteira: fichaPolicy.maxBalance,
              chave: chaveAlocacaoMensal(candidato.userId, local.year, local.month),
              ator: null,
              acao: "alocar_fichas_mensal",
              periodo: chavePeriodo,
            }),
          ),
        "O contrato da empresa não tem fichas suficientes.",
      );
      resultado.pessoas += 1;
      resultado.fichas += quantidade;
    } catch (erro) {
      // Chave repetida é o caminho feliz da segunda execução, não falha.
      if (erro instanceof LancamentoRepetido) resultado.jaFeitas += 1;
      else if (erro instanceof SaldoInsuficiente) resultado.semSaldo += 1;
      else if (erro instanceof TetoDaCarteira) resultado.noTeto += 1;
      else {
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        resultado.erros.push(`${candidato.userId}: ${mensagem}`);
        console.error("[allocate-monthly]", candidato.userId, mensagem);
      }
    }
  }

  const empresas = [...porEmpresa.values()];
  return {
    periodo: chavePeriodo,
    empresas,
    totalPessoas: empresas.reduce((soma, e) => soma + e.pessoas, 0),
    totalFichas: empresas.reduce((soma, e) => soma + e.fichas, 0),
  };
}
