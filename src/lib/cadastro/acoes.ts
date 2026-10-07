"use server";

import { origemDaRequisicao } from "@/lib/auth/origem";
import { loadAppConfig } from "@/lib/config/load";
import { CampoInvalido, email as campoEmail } from "@/lib/forms";
import { CadastroRecusado, enviarCadastro, reenviarConfirmacao } from "./index";
import { caiuNaArmadilha, lerCadastro } from "./regras";

/**
 * As ações públicas do cadastro (A3) — chamadas por quem ainda não entrou.
 * Nenhuma delas escreve em tabela que dê acesso a nada: o login nasce sem
 * papel, e o pedido espera a operadora.
 */

export type CadastroState = {
  erro: string | null;
  /** O e-mail para onde foi o link — a tela troca o formulário pelo aviso. */
  enviadoPara: string | null;
};

export type ReenvioState = { erro: string | null; ok: string | null };

/** Para onde o link de confirmação leva: a página de chegada, no endereço em que a pessoa está. */
async function destinoDaConfirmacao(): Promise<string> {
  return `${await origemDaRequisicao()}/cadastro/confirmado`;
}

export async function cadastrar(_anterior: CadastroState, form: FormData): Promise<CadastroState> {
  let cadastro;
  try {
    cadastro = lerCadastro(form);
  } catch (erro) {
    if (erro instanceof CampoInvalido) return { erro: erro.message, enviadoPara: null };
    throw erro;
  }

  if (caiuNaArmadilha(form)) return { erro: null, enviadoPara: cadastro.email };

  const { legal } = await loadAppConfig();
  try {
    await enviarCadastro(cadastro, await destinoDaConfirmacao(), legal.versao);
  } catch (erro) {
    if (erro instanceof CadastroRecusado) return { erro: erro.message, enviadoPara: null };
    throw erro;
  }

  return { erro: null, enviadoPara: cadastro.email };
}

export async function reenviar(_anterior: ReenvioState, form: FormData): Promise<ReenvioState> {
  let endereco: string;
  try {
    endereco = campoEmail(form, "email");
  } catch (erro) {
    if (erro instanceof CampoInvalido) return { erro: erro.message, ok: null };
    throw erro;
  }

  try {
    await reenviarConfirmacao(endereco, await destinoDaConfirmacao());
  } catch (erro) {
    if (erro instanceof CadastroRecusado) return { erro: erro.message, ok: null };
    throw erro;
  }

  return {
    erro: null,
    ok: "Se houver um cadastro esperando confirmação neste e-mail, o link novo chega em alguns minutos.",
  };
}
