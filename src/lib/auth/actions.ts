"use server";

import { redirect } from "next/navigation";
import { falha, sucesso, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { parseClaims } from "./claims";
import { liberarDaSenhaProvisoria, senhaConfere } from "./conta";
import { HOME_BY_ROLE, safeNext } from "./routes";
import { problemaNaTroca } from "./senha";
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
  if (error !== null) {
    return { erro: "E-mail ou senha incorretos." };
  }

  const { data } = await supabase.auth.getClaims();
  const session = parseClaims(data?.claims);

  // Token emitido, mas sem `user_role`: é assim que o hook trata quem está
  // inativo ou excluído. Deixar a sessão de pé só produziria telas vazias,
  // porque toda policy nega — melhor não entrar e dizer o porquê.
  if (session === null) {
    await supabase.auth.signOut();
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
