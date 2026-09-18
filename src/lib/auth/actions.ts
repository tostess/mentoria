"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseClaims } from "./claims";
import { HOME_BY_ROLE, safeNext } from "./routes";

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
