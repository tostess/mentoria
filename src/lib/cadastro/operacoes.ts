import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import { paraInstante } from "@/lib/db/instantes";
import type { Ator } from "@/lib/ledger/operacoes";
import { contaPessoalNaTransacao } from "@/lib/pessoas/operacoes";

/**
 * As transações do cadastro self-service (A3).
 *
 * Mesmo desenho de `ledger/operacoes.ts` e `pessoas/operacoes.ts`: recebem a
 * transação e não têm `server-only`, para o teste chamar a função que a
 * aplicação chama e desfazer tudo por `rollback`. Quem abre a transação, e
 * quem fala com o servidor de auth, é `cadastro/index.ts`.
 *
 * O pedido vive em `individual_signups`, que nenhum papel autenticado escreve
 * (sem policy e sem privilégio, desde a A1): tudo aqui roda com a conexão de
 * servidor.
 */

export class PedidoInexistente extends Error {
  constructor() {
    super("Pedido de cadastro não encontrado.");
    this.name = "PedidoInexistente";
  }
}

export class PedidoJaDecidido extends Error {
  constructor(nome: string) {
    super(`O pedido de ${nome} já foi decidido.`);
    this.name = "PedidoJaDecidido";
  }
}

export class EmailNaoConfirmado extends Error {
  constructor(nome: string) {
    super(`${nome} ainda não confirmou o e-mail.`);
    this.name = "EmailNaoConfirmado";
  }
}

/** O login do pedido sumiu — só acontece se alguém o apagou à mão. */
export class PedidoSemLogin extends Error {
  constructor(nome: string) {
    super(`O login do pedido de ${nome} não existe mais. Recuse o pedido; a pessoa pode pedir de novo.`);
    this.name = "PedidoSemLogin";
  }
}

export type DadosDoPedido = {
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  linkedin: string | null;
  objetivo: string;
  /** `copy.legal.version` no momento do envio; nula antes de a A5 publicar os textos. */
  versaoDosTermos: string | null;
};

/**
 * Grava o pedido de quem acabou de criar o login.
 *
 * Um pedido aberto por e-mail (`individual_signups_email_pending_uq`): enviar
 * o formulário de novo, antes da decisão, atualiza o pedido em vez de abrir um
 * segundo na fila. É o que acontece com quem não achou o e-mail de confirmação
 * e tentou outra vez — o servidor de auth reenvia o link e devolve o mesmo
 * login. A data do pedido continua a do primeiro envio: é a ordem da fila.
 */
export async function pedidoNaTransacao(
  tx: postgres.TransactionSql,
  userId: string,
  dados: DadosDoPedido,
): Promise<{ id: string }> {
  const [linha] = await tx<{ id: string }[]>`
    insert into individual_signups
      (user_id, name, email, phone, job_title, area, linkedin, goal, terms_version)
    values (${userId}, ${dados.nome}, ${dados.email}, ${dados.telefone}, ${dados.cargo},
            ${dados.area}, ${dados.linkedin}, ${dados.objetivo}, ${dados.versaoDosTermos})
    on conflict (lower(email)) where status = 'pending'
    do update set user_id       = excluded.user_id,
                  name          = excluded.name,
                  phone         = excluded.phone,
                  job_title     = excluded.job_title,
                  area          = excluded.area,
                  linkedin      = excluded.linkedin,
                  goal          = excluded.goal,
                  terms_version = excluded.terms_version
    returning id`;
  return linha;
}

type PedidoTravado = {
  id: string;
  user_id: string | null;
  nome: string;
  email_do_login: string | null;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  status: string;
  confirmado_em: string | null;
};

/**
 * Trava o pedido antes de ler o status — a mesma regra de toda transição de
 * sessão. Duas pessoas da operadora decidindo o mesmo pedido ao mesmo tempo:
 * a segunda espera, relê e recebe `PedidoJaDecidido`.
 */
async function travarPedido(tx: postgres.TransactionSql, pedidoId: string): Promise<PedidoTravado> {
  const [pedido] = await tx<PedidoTravado[]>`
    select s.id, s.user_id, s.name as nome, u.email as email_do_login, s.phone as telefone,
           s.job_title as cargo, s.area, s.status, u.email_confirmed_at as confirmado_em
      from individual_signups s
      left join auth.users u on u.id = s.user_id
     where s.id = ${pedidoId}
       for update of s`;
  if (!pedido) throw new PedidoInexistente();
  return pedido;
}

/**
 * Aprova um pedido: a conta pessoal nasce do login que a pessoa criou, com a
 * senha dela — nada de senha provisória, ninguém repassa acesso.
 *
 * Só com e-mail confirmado. Aprovar antes seria abrir conta para um endereço
 * que pode ter sido digitado errado, ou que nem é de quem preencheu.
 *
 * O e-mail do perfil é o do login, não o digitado no pedido: os dois só
 * diferem em caixa, e o que vale para entrar é o do servidor de auth.
 *
 * A conta é a mesma que a operadora cria à mão (`contaPessoalNaTransacao`):
 * `org` individual, carteira do contrato, perfil e carteira, numa transação.
 * O token da pessoa ganha `user_role` na próxima entrada, pelo hook.
 */
export async function aprovacaoNaTransacao(
  tx: postgres.TransactionSql,
  pedidoId: string,
  ator: Ator,
): Promise<{ userId: string; orgId: string; nome: string }> {
  const pedido = await travarPedido(tx, pedidoId);

  if (pedido.status !== "pending") throw new PedidoJaDecidido(pedido.nome);
  if (pedido.user_id === null || pedido.email_do_login === null) {
    throw new PedidoSemLogin(pedido.nome);
  }
  if (pedido.confirmado_em === null) throw new EmailNaoConfirmado(pedido.nome);

  const { orgId } = await contaPessoalNaTransacao(tx, pedido.user_id, {
    nome: pedido.nome,
    email: pedido.email_do_login,
    telefone: pedido.telefone,
    cargo: pedido.cargo,
    area: pedido.area,
    ator,
    acao: "aprovar_cadastro",
  });

  await tx`
    update individual_signups
       set status = 'approved', decided_by = ${ator.id}, decided_at = now()
     where id = ${pedidoId}`;

  return { userId: pedido.user_id, orgId, nome: pedido.nome };
}

/**
 * Recusa um pedido. Devolve o login, que quem chama apaga **depois** do
 * commit.
 *
 * A ordem é a que não mente em nenhuma falha. Apagar o login antes e falhar no
 * SQL deixaria um pedido pendente sem login — recuperável, mas a decisão não
 * teria acontecido. Pior: entre a leitura e o `delete`, outra pessoa da
 * operadora poderia aprovar, e apagar o login apagaria em cascata o perfil que
 * acabou de nascer. Com o SQL primeiro, a aprovação concorrente espera a trava
 * e desiste. Se apagar o login falhar, sobra um login sem perfil e sem pedido
 * aberto — que não entra em lugar nenhum, e que a rodada diária apaga
 * (`loginsDeRecusados`).
 *
 * O motivo é interno: a pessoa recusada recebe resposta neutra. A auditoria
 * não leva nome nem motivo, porque `audit_logs` é imutável e o pedido é
 * anonimizado em 90 dias.
 */
export async function recusaNaTransacao(
  tx: postgres.TransactionSql,
  pedidoId: string,
  ator: Ator,
  motivo: string | null,
): Promise<{ userId: string | null; nome: string }> {
  const pedido = await travarPedido(tx, pedidoId);
  if (pedido.status !== "pending") throw new PedidoJaDecidido(pedido.nome);

  await tx`
    update individual_signups
       set status = 'rejected', reject_reason = ${motivo},
           decided_by = ${ator.id}, decided_at = now()
     where id = ${pedidoId}`;

  await registrarAuditoria(tx, {
    ator,
    acao: "recusar_cadastro",
    entidade: "individual_signups",
    entidadeId: pedidoId,
  });

  return { userId: pedido.user_id, nome: pedido.nome };
}

/**
 * Logins de pedidos recusados que ainda existem — a recusa apaga o login
 * depois do commit, e esta é a rede para quando a chamada ao servidor de auth
 * falhou. Apagar o login anula `user_id` pela FK (`on delete set null`).
 */
export async function loginsDeRecusados(tx: postgres.TransactionSql | postgres.Sql): Promise<string[]> {
  const linhas = await tx<{ user_id: string }[]>`
    select distinct s.user_id
      from individual_signups s
     where s.status = 'rejected'
       and s.user_id is not null
       and not exists (select 1 from profiles p where p.id = s.user_id)`;
  return linhas.map((l) => l.user_id);
}

/** LGPD: pedido recusado é anonimizado este tanto depois da decisão. */
export const DIAS_ATE_ANONIMIZAR = 90;

/**
 * Anonimiza os pedidos recusados há mais de 90 dias. A linha fica, sem nada de
 * quem pediu: a fila continua contando que houve um pedido e uma decisão.
 *
 * O e-mail vira um endereço inexistente com o id do pedido, porque a coluna é
 * obrigatória; o índice de pedido aberto por e-mail só vale para `pending`,
 * então não há colisão. Idempotente: o que já foi anonimizado não entra de novo.
 */
export async function anonimizacaoNaTransacao(
  tx: postgres.TransactionSql,
  agora: Date,
): Promise<number> {
  const limite = new Date(agora.getTime() - DIAS_ATE_ANONIMIZAR * 24 * 60 * 60 * 1000);
  const linhas = await tx<{ id: string }[]>`
    update individual_signups
       set name = 'Pedido anonimizado',
           email = 'anonimizado-' || id || '@anonimizado.invalid',
           phone = null, job_title = null, area = null, linkedin = null,
           goal = null, reject_reason = null,
           anonymized_at = ${paraInstante(agora)}::text::timestamptz
     where status = 'rejected'
       and anonymized_at is null
       and decided_at < ${paraInstante(limite)}::text::timestamptz
    returning id`;

  if (linhas.length > 0) {
    await registrarAuditoria(tx, {
      ator: null,
      acao: "anonimizar_cadastros",
      entidade: "individual_signups",
      depois: { quantidade: linhas.length },
    });
  }
  return linhas.length;
}
