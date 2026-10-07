import { problemaNaSenhaNova } from "@/lib/auth/senha";
import { CampoInvalido, email, marcado, texto, textoOpcional } from "@/lib/forms";

/**
 * O cadastro self-service do Profissional avulso (A3) — o que a pessoa
 * preenche em `/cadastro` e o que a operadora lê para decidir.
 *
 * Módulo puro: a Server Action lê aqui e o teste confere as mesmas regras sem
 * rede. A senha não fica no pedido — vai direto ao servidor de auth no
 * `signUp`, e o banco só guarda o hash.
 */

export type NovoCadastro = {
  nome: string;
  email: string;
  senha: string;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  linkedin: string | null;
  /** O que a pessoa busca na mentoria — é o que a operadora lê para decidir. */
  objetivo: string;
};

export const OBJETIVO_MAX = 1000;

/**
 * Lê e valida o formulário. Lança `CampoInvalido` com a frase que a pessoa lê.
 *
 * O aceite dos termos é exigido mesmo enquanto a operadora não publicou os
 * textos (A5): o pedido grava a versão aceita, e um cadastro sem aceite nenhum
 * não teria o que gravar quando os textos chegarem.
 */
export function lerCadastro(form: FormData): NovoCadastro {
  const nome = texto(form, "nome", "seu nome", 160);
  const endereco = email(form, "email");

  const senha = bruto(form, "senha");
  const problema = problemaNaSenhaNova(senha, bruto(form, "confirmacao"));
  if (problema !== null) throw new CampoInvalido(problema);

  const objetivo = texto(form, "objetivo", "o que você busca na mentoria", OBJETIVO_MAX);

  if (!marcado(form, "aceite")) {
    throw new CampoInvalido("Para criar a conta, aceite os termos de uso e a política de privacidade.");
  }

  return {
    nome,
    email: endereco,
    senha,
    telefone: textoOpcional(form, "telefone", 40),
    cargo: textoOpcional(form, "cargo", 120),
    area: textoOpcional(form, "area", 120),
    linkedin: linkedinOpcional(form, "linkedin"),
    objetivo,
  };
}

/**
 * Campo-armadilha para robô: invisível para quem usa a tela, preenchido por
 * quem preenche todo `input` que encontra. Quem cai nele recebe a mesma tela de
 * sucesso de todo mundo e nenhum pedido é gravado — recusar abertamente só
 * ensinaria o robô a desviar.
 */
export const CAMPO_ARMADILHA = "site";

export function caiuNaArmadilha(form: FormData): boolean {
  return bruto(form, CAMPO_ARMADILHA) !== "";
}

/**
 * Endereço do LinkedIn, ou de onde a pessoa mostrar o trabalho dela. Aceita
 * sem `https://` — é como se copia da barra do celular — e guarda com.
 * Só endereço web: `javascript:` nunca chega a virar link na tela da operadora.
 */
export function linkedinOpcional(form: FormData, nome: string): string | null {
  const valor = textoOpcional(form, nome, 300);
  if (valor === null) return null;

  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(valor) ? valor : `https://${valor}`;
  let url: URL;
  try {
    url = new URL(comEsquema);
  } catch {
    throw new CampoInvalido("O endereço do LinkedIn não parece um link. Copie da barra do navegador.");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) {
    throw new CampoInvalido("O endereço do LinkedIn não parece um link. Copie da barra do navegador.");
  }
  return url.toString();
}

/** A senha não passa por `trim`: espaço nela é recusado, não apagado em silêncio. */
function bruto(form: FormData, nome: string): string {
  const valor = form.get(nome);
  return typeof valor === "string" ? valor : "";
}
