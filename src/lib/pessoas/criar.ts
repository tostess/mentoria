import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { getSql } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  empresaNaTransacao,
  parceiroNaTransacao,
  profissionalNaTransacao,
  type NovaEmpresa,
  type NovoParceiro,
  type NovoProfissional,
} from "./operacoes";

/**
 * Criação de empresa e de pessoa, no piloto fechado — tudo pela mão do admin.
 *
 * Invariante 8: o Parceiro nunca se autocadastra. No piloto ele também não
 * entra por token: entra porque o admin decidiu, e a decisão fica em
 * `audit_logs` com o nome de quem tomou.
 *
 * A identidade mora em `auth.users` e o perfil em `profiles`, e **os dois não
 * cabem numa transação só** — um é chamada HTTP ao servidor de auth, o outro é
 * SQL. A ordem escolhida é criar a identidade primeiro e apagá-la se o SQL
 * falhar: o inverso deixaria perfil sem login, que é invisível até alguém
 * tentar entrar. Assim a falha é sempre "não existe", nunca "existe pela
 * metade".
 */

export { ENGAJAMENTOS } from "./operacoes";
export type { Engajamento, NovaEmpresa, NovoParceiro, NovoProfissional } from "./operacoes";

export class EmailJaUsado extends Error {
  constructor() {
    super("Já existe uma conta com este e-mail.");
    this.name = "EmailJaUsado";
  }
}

/** O servidor de auth não distingue e-mail repetido por código, só por mensagem. */
export function ehEmailRepetido(mensagem: string): boolean {
  return /already|registered|exists/i.test(mensagem);
}

/**
 * Senha provisória de 16 caracteres, para o admin repassar.
 *
 * O piloto não tem envio de e-mail (Resend entra depois), então convite por
 * link não existe ainda. Deixar o admin inventar a senha produziria
 * "mentoria123" em todas as contas; sortear aqui e mostrar uma vez é o menor
 * dos males até o convite existir.
 *
 * Sem caracteres ambíguos: esta senha vai ser lida em voz alta ou colada num
 * WhatsApp, e `l` contra `1` custa um suporte.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%?";

export function senhaProvisoria(tamanho = 16): string {
  let senha = "";
  for (let i = 0; i < tamanho; i += 1) senha += ALFABETO[randomInt(ALFABETO.length)];
  return senha;
}

export type PessoaCriada = { id: string; senha: string };

/** A empresa não tem identidade de login — é só SQL, numa transação. */
export async function criarEmpresa(nova: NovaEmpresa): Promise<{ id: string }> {
  return getSql().begin((tx) => empresaNaTransacao(tx, nova));
}

export async function criarProfissional(novo: NovoProfissional): Promise<PessoaCriada> {
  return comIdentidade(novo.email, (userId, tx) => profissionalNaTransacao(tx, userId, novo));
}

export async function criarParceiro(novo: NovoParceiro): Promise<PessoaCriada> {
  return comIdentidade(novo.email, (userId, tx) => parceiroNaTransacao(tx, userId, novo));
}

/**
 * Cria a identidade no servidor de auth, roda o SQL do perfil e desfaz a
 * identidade se o SQL falhar.
 *
 * `email_confirm: true` porque o admin acabou de digitar o endereço a partir
 * do contrato: exigir confirmação por e-mail num piloto sem envio de e-mail
 * seria criar conta que ninguém consegue abrir.
 *
 * O `id` é sorteado aqui, e não pelo servidor de auth, para que a compensação
 * saiba o que apagar mesmo se a resposta se perder no caminho.
 */
async function comIdentidade(
  email: string,
  dentroDaTransacao: (userId: string, tx: postgres.TransactionSql) => Promise<void>,
): Promise<PessoaCriada> {
  const admin = createAdminClient();
  const userId = randomUUID();
  const senha = senhaProvisoria();

  const { error } = await admin.auth.admin.createUser({
    id: userId,
    email,
    password: senha,
    email_confirm: true,
  });

  if (error !== null) {
    if (ehEmailRepetido(error.message)) throw new EmailJaUsado();
    throw new Error(`não foi possível criar a conta: ${error.message}`);
  }

  try {
    await getSql().begin((tx) => dentroDaTransacao(userId, tx));
    return { id: userId, senha };
  } catch (erro) {
    // Compensação: sem ela sobra login sem perfil, que entra e cai em "acesso
    // inativo" sem ninguém entender por quê.
    await admin.auth.admin.deleteUser(userId).catch((falha) => {
      console.error(`[pessoas] identidade órfã ${userId} — apague à mão:`, falha);
    });
    throw erro;
  }
}
