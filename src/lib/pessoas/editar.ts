import "server-only";

import type postgres from "postgres";
import { registrarAuditoria } from "@/lib/audit";
import { CHAVE_SENHA_PROVISORIA } from "@/lib/auth/senha";
import { getSql } from "@/lib/db";
import type { Ator } from "@/lib/ledger/operacoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailJaUsado, ehEmailRepetido, senhaProvisoria } from "./criar";
import {
  PessoaInexistente,
  acessoNaTransacao,
  edicaoParceiroNaTransacao,
  edicaoProfissionalNaTransacao,
  statusParceiroNaTransacao,
  type DadosDoParceiro,
  type DadosDoProfissional,
  type ResultadoDaEdicao,
  type StatusOperavel,
} from "./edicao";

/**
 * Edição de pessoa — as portas que abrem a transação e falam com o servidor
 * de auth. O SQL mora em `edicao.ts`.
 *
 * O e-mail vive em dois lugares: `auth.users` (é com ele que a pessoa entra) e
 * `profiles` (é ele que a tela mostra). Como na criação, os dois não cabem
 * numa transação, e a ordem é a mesma de `criar.ts`: auth primeiro, SQL
 * depois, e desfazer o auth se o SQL falhar. O inverso deixaria a tela dizendo
 * um e-mail e o login aceitando outro — que só aparece quando a pessoa não
 * consegue entrar.
 *
 * **Nunca** se abre transação em volta da chamada HTTP: a conexão de runtime é
 * o pooler com `max: 1`, e segurá-la durante uma ida ao auth deixaria toda
 * outra requisição do processo na fila.
 */

export {
  PessoaInexistente,
  TemSessaoFutura,
  TransicaoInvalida,
  STATUS_OPERAVEIS,
  type StatusOperavel,
} from "./edicao";

async function emailAtual(
  id: string,
  papel: "partner" | "professional",
  orgId: string | null,
): Promise<string> {
  const [linha] = await getSql()<{ email: string }[]>`
    select email
      from profiles
     where id = ${id}
       and role = ${papel}::user_role
       and (${orgId}::uuid is null or org_id = ${orgId}::uuid)
       and deleted_at is null`;
  if (!linha) throw new PessoaInexistente();
  return linha.email;
}

/**
 * O e-mail já é login de outra conta?
 *
 * Conferido antes, e não reconhecido pelo erro, porque o servidor de auth não
 * diz: na **criação** ele responde "already registered", mas na **troca** de
 * e-mail responde `500 Error updating user`, sem código nem pista — medido
 * contra o `mentoria-dev`. Sem esta consulta a operadora leria um erro
 * genérico em vez de "Já existe uma conta com este e-mail".
 *
 * Perde a corrida para outra troca simultânea para o mesmo endereço; aí o
 * auth recusa do mesmo jeito e o erro sai genérico. Raro e sem dano.
 */
async function emailEmUso(email: string, excetoId: string): Promise<boolean> {
  const [linha] = await getSql()<{ id: string }[]>`
    select id from auth.users where lower(email) = lower(${email}) and id <> ${excetoId} limit 1`;
  return linha !== undefined;
}

async function trocarEmailNoAuth(id: string, email: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
  });
  if (error === null) return;
  if (ehEmailRepetido(error.message)) throw new EmailJaUsado();
  throw new Error(`não foi possível trocar o e-mail: ${error.message}`);
}

/**
 * Roda a edição SQL com o e-mail já trocado no auth, e devolve o e-mail antigo
 * ao auth se o SQL falhar.
 */
async function comEmail(
  id: string,
  anterior: string,
  novo: string,
  sql: (tx: postgres.TransactionSql) => Promise<ResultadoDaEdicao>,
): Promise<ResultadoDaEdicao> {
  const troca = anterior !== novo;
  if (troca) {
    if (await emailEmUso(novo, id)) throw new EmailJaUsado();
    await trocarEmailNoAuth(id, novo);
  }

  try {
    return await getSql().begin(sql);
  } catch (erro) {
    if (troca) {
      await trocarEmailNoAuth(id, anterior).catch((falha) => {
        console.error(
          `[pessoas] e-mail de ${id} ficou ${novo} no auth — volte para ${anterior}:`,
          falha,
        );
      });
    }
    throw erro;
  }
}

export async function editarParceiro(
  id: string,
  dados: DadosDoParceiro,
  ator: Ator,
): Promise<ResultadoDaEdicao> {
  const anterior = await emailAtual(id, "partner", null);
  return comEmail(id, anterior, dados.email, (tx) =>
    edicaoParceiroNaTransacao(tx, id, dados, ator),
  );
}

export async function editarProfissional(
  id: string,
  orgId: string,
  dados: DadosDoProfissional,
  ator: Ator,
): Promise<ResultadoDaEdicao> {
  const anterior = await emailAtual(id, "professional", orgId);
  return comEmail(id, anterior, dados.email, (tx) =>
    edicaoProfissionalNaTransacao(tx, id, orgId, dados, ator),
  );
}

export async function alterarStatusDoParceiro(
  id: string,
  novo: StatusOperavel,
  ator: Ator,
): Promise<{ antes: string }> {
  return getSql().begin((tx) => statusParceiroNaTransacao(tx, id, novo, ator));
}

export async function alterarAcesso(
  id: string,
  orgId: string,
  ativo: boolean,
  ator: Ator,
): Promise<{ mudou: boolean }> {
  return getSql().begin((tx) => acessoNaTransacao(tx, id, orgId, ativo, ator));
}

export type Alvo = { papel: "partner" } | { papel: "professional"; orgId: string };

/**
 * Nova senha provisória, mostrada uma vez — o mesmo trato da criação.
 *
 * O alvo é conferido antes de qualquer coisa: só Parceiro, ou Profissional da
 * empresa informada. Sem isso, um POST forjado com o id da própria operadora
 * trocaria a senha de uma conta `admin`.
 *
 * A senha é trocada no auth e **depois** auditada. Se a auditoria falhar, a
 * senha nova não é devolvida: fica valendo uma senha que ninguém viu, que não
 * é acesso concedido a ninguém, e o admin tenta de novo. O contrário —
 * auditar antes — gravaria "gerou senha" para uma troca que pode não ter
 * acontecido.
 */
export async function novaSenhaProvisoria(
  id: string,
  alvo: Alvo,
  ator: Ator,
): Promise<{ email: string; senha: string }> {
  const orgId = alvo.papel === "professional" ? alvo.orgId : null;
  const email = await emailAtual(id, alvo.papel, orgId);
  const senha = senhaProvisoria();

  // A marca volta junto: senha nova dada pelo admin é provisória de novo, e o
  // aviso reaparece no próximo acesso — no mesmo pedido, para não haver senha
  // provisória sem marca nem por um instante.
  const { error } = await createAdminClient().auth.admin.updateUserById(id, {
    password: senha,
    app_metadata: { [CHAVE_SENHA_PROVISORIA]: true },
  });
  if (error !== null) throw new Error(`não foi possível trocar a senha: ${error.message}`);

  await getSql().begin((tx) =>
    registrarAuditoria(tx, {
      ator,
      orgId,
      acao: "redefinir_senha",
      entidade: "profiles",
      entidadeId: id,
    }),
  );

  return { email, senha };
}
