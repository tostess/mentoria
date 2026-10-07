"use server";

import { redirect } from "next/navigation";
import { pedidoPendenteDoLogin } from "@/lib/cadastro";
import { CampoInvalido, email as campoEmail, falha, sucesso, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { parseClaims } from "./claims";
import {
  enviarLinkDeRecuperacao,
  liberarDaSenhaProvisoria,
  redefinirPorLink,
  senhaConfere,
} from "./conta";
import { origemDaRequisicao } from "./origem";
import { HOME_BY_ROLE, safeNext } from "./routes";
import { problemaNaSenhaNova, problemaNaTroca } from "./senha";
import { getSession } from "./session";

/**
 * Entrar e sair. São Server Actions porque só o servidor pode gravar o cookie
 * de sessão de forma confiável — e porque a senha não precisa passar pelo
 * cliente do Supabase no navegador.
 */

/**
 * Só função assíncrona pode ser exportada de um módulo `"use server"` — tipo
 * é apagado na compilação e passa; constante não passaria.
 */
export type EntrarState = { erro: string | null };

function campo(formData: FormData, nome: string): string {
  const value = formData.get(nome);
  return typeof value === "string" ? value : "";
}

export async function entrar(_anterior: EntrarState, formData: FormData): Promise<EntrarState> {
  const email = campo(formData, "email").trim();
  const senha = campo(formData, "senha");
  const next = campo(formData, "next");

  if (email === "" || senha === "") {
    return { erro: "Preencha e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  // Mensagem única para credencial errada e e-mail inexistente: distinguir as
  // duas entrega uma lista de quem trabalha na empresa a quem tentar.
  //
  // E-mail sem confirmar é a exceção, e não vaza nada: o servidor de auth só
  // diz isso depois de conferir a senha, então quem lê a frase é o dono dela.
  if (error !== null) {
    if (error.code === "email_not_confirmed") {
      return {
        erro: "Confirme seu e-mail antes de entrar: o link está na mensagem que enviamos no cadastro.",
      };
    }
    return { erro: "E-mail ou senha incorretos." };
  }

  const { data } = await supabase.auth.getClaims();
  const session = parseClaims(data?.claims);

  // Token emitido, mas sem `user_role`: é assim que o hook trata quem está
  // inativo ou excluído — e quem se cadastrou e ainda espera a operadora (A3).
  // Deixar a sessão de pé só produziria telas vazias, porque toda policy nega —
  // melhor não entrar e dizer o porquê.
  if (session === null) {
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    await supabase.auth.signOut();
    if (userId !== null && (await pedidoPendenteDoLogin(userId))) {
      return {
        erro: "Seu cadastro está em análise. Assim que for aprovado, você entra com este e-mail e esta senha.",
      };
    }
    return { erro: "Seu acesso está inativo. Fale com quem administra sua conta." };
  }

  redirect(safeNext(next, session.role) ?? HOME_BY_ROLE[session.role]);
}

export async function sair(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

/**
 * A própria pessoa troca a senha — pelo menu da conta ou pelo aviso de senha
 * provisória, que é o mesmo formulário.
 *
 * Não grava `audit_logs`: a invariante 12 é sobre ação de admin, moderador ou
 * RH sobre terceiro, e trocar a própria senha não é — a mesma leitura de
 * "Parceiro mexendo em si".
 *
 * A ordem é a que não mente em nenhuma falha: conferir a senha atual, trocar
 * pela sessão da pessoa, e só então tirar a marca. Se a marca não sair, o aviso
 * volta no próximo acesso para quem já trocou — incômodo, não inseguro. O
 * contrário deixaria a senha do WhatsApp valendo sem aviso nenhum.
 */
export async function trocarSenha(_anterior: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (session === null) return falha("Sua sessão expirou. Entre de novo para trocar a senha.");
  if (session.email === null) return falha("Esta conta não entra por e-mail e senha.");

  const troca = {
    atual: campo(formData, "atual"),
    nova: campo(formData, "nova"),
    confirmacao: campo(formData, "confirmacao"),
  };
  const problema = problemaNaTroca(troca);
  if (problema !== null) return falha(problema);

  if (!(await senhaConfere(session.email, troca.atual))) {
    return falha("A senha atual não confere.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: troca.nova });
  if (error !== null) {
    switch (error.code) {
      case "same_password":
        return falha("A senha nova precisa ser diferente da atual.");
      case "weak_password":
        return falha("Essa senha é fraca demais. Use uma mais longa, misturando letras, números e símbolos.");
      case "reauthentication_needed":
        return falha("Por segurança, saia e entre de novo antes de trocar a senha.");
      default:
        throw new Error(`não foi possível trocar a senha: ${error.message}`);
    }
  }

  try {
    await liberarDaSenhaProvisoria(session.userId);
    // O token em uso ainda carrega a marca; sem renovar, o aviso só sumiria
    // quando o token vencesse sozinho, até uma hora depois.
    const renovacao = await supabase.auth.refreshSession();
    if (renovacao.error !== null) throw renovacao.error;
  } catch (erro) {
    console.error(`[conta] senha de ${session.userId} trocada, marca não saiu:`, erro);
  }

  return sucesso("Senha alterada. Use a nova a partir do próximo acesso.");
}

/**
 * "Esqueceu a senha?" — manda o link de recuperação. A frase de sucesso é a
 * mesma exista ou não a conta: o formulário não pode virar consulta de quem
 * usa a plataforma.
 */
export async function pedirRecuperacao(_anterior: FormState, formData: FormData): Promise<FormState> {
  let endereco: string;
  try {
    endereco = campoEmail(formData, "email");
  } catch (erro) {
    if (erro instanceof CampoInvalido) return falha(erro.message);
    throw erro;
  }

  const resultado = await enviarLinkDeRecuperacao(endereco, `${await origemDaRequisicao()}/redefinir-senha`);
  if (resultado === "limite") {
    return falha("Muitos envios em pouco tempo. Espere alguns minutos e peça de novo.");
  }
  return sucesso(
    `Se ${endereco} tiver conta, o link para criar uma senha nova chega em alguns minutos. Ele vale por pouco tempo e uma vez só.`,
  );
}

/**
 * A senha nova, escolhida na página do link. Os tokens vêm do fragmento do
 * endereço, lidos pelo cliente; quem decide se ainda valem é `redefinirPorLink`.
 */
export async function redefinirSenha(_anterior: FormState, formData: FormData): Promise<FormState> {
  const nova = campo(formData, "nova");
  const problema = problemaNaSenhaNova(nova, campo(formData, "confirmacao"));
  if (problema !== null) return falha(problema);

  const accessToken = campo(formData, "access_token");
  const refreshToken = campo(formData, "refresh_token");
  if (accessToken === "" || refreshToken === "") {
    return falha("Este link não vale mais. Peça outro em “Esqueceu a senha?”.");
  }

  switch (await redefinirPorLink(accessToken, refreshToken, nova)) {
    case "ok":
      return sucesso("Senha nova salva. Entre com ela.");
    case "link-vencido":
      return falha("Este link não vale mais. Peça outro em “Esqueceu a senha?”.");
    case "fraca":
      return falha("Essa senha é fraca demais. Use uma mais longa, misturando letras, números e símbolos.");
    case "igual":
      return falha("A senha nova precisa ser diferente da que você usava.");
  }
}
