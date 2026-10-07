import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSql } from "@/lib/db";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Ator } from "@/lib/ledger/operacoes";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EmailNaoConfirmado,
  PedidoInexistente,
  PedidoJaDecidido,
  PedidoSemLogin,
  aprovacaoNaTransacao,
  anonimizacaoNaTransacao,
  loginsDeRecusados,
  pedidoNaTransacao,
  recusaNaTransacao,
} from "./operacoes";
import type { NovoCadastro } from "./regras";

export {
  EmailNaoConfirmado,
  PedidoInexistente,
  PedidoJaDecidido,
  PedidoSemLogin,
} from "./operacoes";

/**
 * O cadastro self-service do avulso (A3), do lado do servidor.
 *
 * O login nasce no `signUp` do Supabase Auth, com a senha da própria pessoa, e
 * o servidor de auth manda o link de confirmação. O pedido nasce aqui, em
 * `individual_signups`. Enquanto a operadora não aprova não existe perfil — e
 * sem perfil o hook não põe `user_role` no token, então toda policy nega.
 */

/** Recusa que a pessoa pode resolver: a frase vai para a tela. */
export class CadastroRecusado extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CadastroRecusado";
  }
}

/**
 * Cliente sem sessão e sem cookie, como o de `senhaConfere`. O cadastro não
 * deixa ninguém logado — com confirmação de e-mail o `signUp` nem devolve
 * sessão — e não há código PKCE para guardar: o link de confirmação confirma
 * no servidor de auth, e a página de chegada não troca o código por sessão.
 */
function clienteAvulso() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  return createSupabaseClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Os códigos do servidor de auth que a pessoa consegue resolver sozinha. */
function recusaDoAuth(codigo: string | undefined): CadastroRecusado | null {
  switch (codigo) {
    case "weak_password":
      return new CadastroRecusado(
        "Essa senha é fraca demais. Use uma mais longa, misturando letras, números e símbolos.",
      );
    case "email_address_invalid":
      return new CadastroRecusado("Esse e-mail não foi aceito. Confira o endereço.");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return new CadastroRecusado("Muitos cadastros neste momento. Tente de novo em alguns minutos.");
    case "signup_disabled":
      return new CadastroRecusado("O cadastro está fechado no momento.");
    default:
      return null;
  }
}

/**
 * Cria o login e grava o pedido.
 *
 * **E-mail que já tem conta não é erro.** Com confirmação de e-mail ligada, o
 * servidor de auth responde ao `signUp` de um e-mail existente com um usuário
 * sem identidade, sem enviar nada (medido no `mentoria-dev` em 06/10/2026) —
 * para que o cadastro não sirva de consulta de quem tem conta. Aqui o pedido
 * simplesmente não é gravado, e a tela é a mesma de todo mundo; ela avisa que
 * a conta pessoal pede um e-mail diferente do corporativo.
 *
 * Login e pedido não cabem numa transação (um é HTTP, o outro SQL). Se o SQL
 * falhar, o login recém-criado é apagado, como em `pessoas/criar.ts`; o login
 * de um reenvio (mesmo e-mail, ainda sem confirmar) já tinha pedido e fica.
 */
export async function enviarCadastro(
  cadastro: NovoCadastro,
  destinoDaConfirmacao: string,
  versaoDosTermos: string | null,
): Promise<void> {
  const { data, error } = await clienteAvulso().auth.signUp({
    email: cadastro.email,
    password: cadastro.senha,
    options: { emailRedirectTo: destinoDaConfirmacao },
  });

  if (error !== null) {
    const recusa = recusaDoAuth(error.code);
    if (recusa !== null) throw recusa;
    throw new Error(`não foi possível criar o login: ${error.code ?? ""} ${error.message}`);
  }

  const usuario = data.user;
  if (usuario === null || (usuario.identities ?? []).length === 0) return;

  const novo = Date.now() - new Date(usuario.created_at).getTime() < 60_000;

  try {
    await getSql().begin((tx) =>
      pedidoNaTransacao(tx, usuario.id, {
        nome: cadastro.nome,
        email: cadastro.email,
        telefone: cadastro.telefone,
        cargo: cadastro.cargo,
        area: cadastro.area,
        linkedin: cadastro.linkedin,
        objetivo: cadastro.objetivo,
        versaoDosTermos,
      }),
    );
  } catch (erro) {
    if (novo) {
      await createAdminClient()
        .auth.admin.deleteUser(usuario.id)
        .catch((falha) => console.error(`[cadastro] login órfão ${usuario.id} — apague à mão:`, falha));
    }
    throw erro;
  }
}

/**
 * Reenvia o link de confirmação. A resposta é a mesma para qualquer e-mail —
 * existente ou não, já confirmado ou não —, exceto o limite de envio, que é a
 * única coisa que a pessoa precisa saber para agir.
 */
export async function reenviarConfirmacao(email: string, destinoDaConfirmacao: string): Promise<void> {
  const { error } = await clienteAvulso().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: destinoDaConfirmacao },
  });
  if (error === null) return;
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    throw new CadastroRecusado("Muitos envios em pouco tempo. Espere alguns minutos e tente de novo.");
  }
  console.warn(`[cadastro] reenvio recusado: ${error.code ?? ""} ${error.message}`);
}

/** Em que pé está o pedido de quem tem login e ainda não tem perfil. */
export async function pedidoPendenteDoLogin(userId: string): Promise<boolean> {
  const [linha] = await getSql()<{ existe: boolean }[]>`
    select exists (
      select 1 from individual_signups where user_id = ${userId} and status = 'pending'
    ) as existe`;
  return linha?.existe ?? false;
}

export type ResultadoDaAprovacao = {
  aprovados: string[];
  /** A frase de cada pedido que não passou — já com o nome, quando se sabe. */
  falhas: string[];
};

/**
 * Aprovação em lote: **uma transação por pessoa**, como a recarga mensal. Um
 * e-mail ainda sem confirmar, ou um pedido que outra pessoa da operadora
 * acabou de decidir, não pode impedir os outros de virar conta.
 *
 * Sequencial: a conexão de runtime é `max: 1`.
 */
export async function aprovarPedidos(ids: readonly string[], ator: Ator): Promise<ResultadoDaAprovacao> {
  const resultado: ResultadoDaAprovacao = { aprovados: [], falhas: [] };

  for (const id of ids) {
    try {
      const { nome } = await getSql().begin((tx) => aprovacaoNaTransacao(tx, id, ator));
      resultado.aprovados.push(nome);
    } catch (erro) {
      if (
        erro instanceof EmailNaoConfirmado ||
        erro instanceof PedidoJaDecidido ||
        erro instanceof PedidoSemLogin ||
        erro instanceof PedidoInexistente
      ) {
        resultado.falhas.push(erro.message);
        continue;
      }
      console.error(`[cadastro] aprovação do pedido ${id} falhou:`, erro);
      resultado.falhas.push("Um pedido não pôde ser aprovado agora. Tente de novo.");
    }
  }

  return resultado;
}

/**
 * Recusa: a decisão no banco primeiro, depois o login apagado — a ordem e o
 * porquê estão em `recusaNaTransacao`. Falhar ao apagar o login não desfaz a
 * recusa; a rodada diária (`limparRecusados`) tenta de novo.
 */
export async function recusarPedido(id: string, ator: Ator, motivo: string | null): Promise<string> {
  const { userId, nome } = await getSql().begin((tx) => recusaNaTransacao(tx, id, ator, motivo));
  if (userId !== null) await apagarLogin(userId);
  return nome;
}

async function apagarLogin(userId: string): Promise<boolean> {
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error === null) return true;
  console.error(`[cadastro] login ${userId} de pedido recusado não foi apagado:`, error.message);
  return false;
}

export type ResultadoDaLimpeza = { loginsApagados: number; loginsComErro: number; anonimizados: number };

/**
 * A rodada diária do cadastro: apaga o login que a recusa não conseguiu apagar
 * e anonimiza o pedido recusado há mais de 90 dias. Idempotente nas duas
 * partes — login apagado some da consulta, pedido anonimizado tem a marca.
 */
export async function limparRecusados(agora: Date): Promise<ResultadoDaLimpeza> {
  const logins = await loginsDeRecusados(getSql());
  let loginsApagados = 0;
  for (const userId of logins) {
    if (await apagarLogin(userId)) loginsApagados += 1;
  }

  const anonimizados = await getSql().begin((tx) => anonimizacaoNaTransacao(tx, agora));
  return { loginsApagados, loginsComErro: logins.length - loginsApagados, anonimizados };
}
