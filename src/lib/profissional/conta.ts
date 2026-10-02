import type { TipoDeConta } from "@/lib/auth/claims";
import { cap, type Terms } from "@/lib/terms";

/**
 * As frases do Profissional que mudam com o tipo de conta.
 *
 * O colaborador de empresa recebe ficha do RH, e o RH vê o uso agregado; o
 * avulso compra a própria ficha, e ninguém de empresa nenhuma vê a conta
 * pessoal — nem a empresa onde a mesma pessoa tem a conta corporativa. Escrever
 * "o RH da sua empresa" para quem não tem empresa seria a tela inventando um
 * vínculo, e prometer privacidade "do RH" a quem não tem RH seria mentir pela
 * metade.
 *
 * Puro: o tipo vem do token (`Session.tipoDeConta`), os termos de `app_config`.
 */

/** De onde a ficha vem, numa frase que cabe depois de "Você não tem ficha". */
export function deOndeVemAFicha(tipo: TipoDeConta | null, t: Terms): string {
  if (tipo === "pessoal") {
    return `As ${t.fichas} da sua ${t.individual.toLowerCase()} chegam com a compra de um pacote — por enquanto, combinada com a operadora.`;
  }
  return `O ${t.orgAdmin} da sua empresa distribui as ${t.fichas}.`;
}

/** Quem vê o quê — a promessa de privacidade, do tamanho certo para cada conta. */
export function quemVe(tipo: TipoDeConta | null, t: Terms): string {
  if (tipo === "pessoal") {
    return `Sua ${t.individual.toLowerCase()} é só sua: nenhuma empresa vê o que você usa aqui, nem com quem conversou.`;
  }
  return `O ${t.orgAdmin} da sua empresa vê quantas ${t.fichas} foram usadas no total, mas nunca com quem você conversou nem sobre o quê.`;
}

/** A regra de validade, para o card "Como a ficha funciona". */
export function validadeDaFicha(
  tipo: TipoDeConta | null,
  meses: number,
  expiram: boolean,
): string {
  if (tipo === "pessoal") return `${meses} ${meses === 1 ? "mês" : "meses"} após a compra`;
  return expiram ? "expiram" : "não expiram";
}

/** A frase de rodapé do mesmo card. */
export function regraDaFicha(tipo: TipoDeConta | null, meses: number, t: Terms): string {
  if (tipo === "pessoal") {
    return `${cap(t.fichas)} compradas valem ${meses} ${meses === 1 ? "mês" : "meses"}, as que vencem antes são usadas primeiro, e não passam para outra pessoa — nem para uma conta de empresa.`;
  }
  return `${cap(t.fichas)} acumulam de um mês para o outro e não podem ser compradas nem passadas para outra pessoa.`;
}
