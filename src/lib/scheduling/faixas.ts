import type { Faixa } from "./tipos";

/**
 * Aritmética de faixas de minutos. Puro, sem fuso e sem data — só números.
 *
 * Existe separado porque é a parte do motor que erra em silêncio: duas regras
 * que se encostam, um bloqueio que corta uma faixa no meio e a parte-se em
 * duas, um bloqueio que engole a faixa inteira. Nada disso levanta exceção
 * quando está errado — só produz horário a mais ou a menos. Então vive aqui,
 * pequeno e coberto por teste.
 *
 * Convenção em todo o arquivo: `inicio` inclusivo, `fim` exclusivo. É o que
 * faz 9h–12h e 12h–15h serem vizinhas em vez de sobrepostas.
 */

const MINUTOS_NO_DIA = 1440;

export { MINUTOS_NO_DIA };

/** Faixa que vale: dentro do dia e com duração positiva. */
export function ehValida(faixa: Faixa): boolean {
  return (
    Number.isInteger(faixa.inicio) &&
    Number.isInteger(faixa.fim) &&
    faixa.inicio >= 0 &&
    faixa.fim <= MINUTOS_NO_DIA &&
    faixa.fim > faixa.inicio
  );
}

/** Recorta para dentro do dia. Devolve null se não sobrar nada. */
export function aoDia(faixa: Faixa): Faixa | null {
  const recortada = {
    inicio: Math.max(0, Math.min(MINUTOS_NO_DIA, faixa.inicio)),
    fim: Math.max(0, Math.min(MINUTOS_NO_DIA, faixa.fim)),
  };
  return recortada.fim > recortada.inicio ? recortada : null;
}

/**
 * Ordena e funde o que se sobrepõe **ou se encosta**.
 *
 * Fundir vizinhas é o ponto: 9h–12h mais 12h–15h tem de virar 9h–15h, senão
 * uma sessão de 30 minutos às 11h45 seria recusada por atravessar uma fronteira
 * que só existe no jeito como o Parceiro digitou a disponibilidade.
 */
export function normalizar(faixas: readonly Faixa[]): Faixa[] {
  const validas = faixas.filter(ehValida).sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  const fundidas: Faixa[] = [];

  for (const faixa of validas) {
    const ultima = fundidas[fundidas.length - 1];
    if (ultima !== undefined && faixa.inicio <= ultima.fim) {
      ultima.fim = Math.max(ultima.fim, faixa.fim);
    } else {
      fundidas.push({ ...faixa });
    }
  }

  return fundidas;
}

export function unir(a: readonly Faixa[], b: readonly Faixa[]): Faixa[] {
  return normalizar([...a, ...b]);
}

/**
 * O que sobra de `base` depois de remover `remover`.
 *
 * Um bloqueio no meio de uma faixa a divide em duas — é o caso que costuma
 * faltar em implementação feita às pressas, e o motivo pelo qual esta função
 * devolve lista e não faixa.
 */
export function subtrair(base: readonly Faixa[], remover: readonly Faixa[]): Faixa[] {
  const buracos = normalizar(remover);
  let sobra = normalizar(base);

  for (const buraco of buracos) {
    const proxima: Faixa[] = [];
    for (const faixa of sobra) {
      // Sem interseção: passa inteira.
      if (buraco.fim <= faixa.inicio || buraco.inicio >= faixa.fim) {
        proxima.push(faixa);
        continue;
      }
      if (buraco.inicio > faixa.inicio) proxima.push({ inicio: faixa.inicio, fim: buraco.inicio });
      if (buraco.fim < faixa.fim) proxima.push({ inicio: buraco.fim, fim: faixa.fim });
      // Buraco cobrindo a faixa inteira não empurra nada — a faixa desaparece.
    }
    sobra = proxima;
  }

  return sobra;
}

/** Os dois se sobrepõem em pelo menos um minuto? */
export function seSobrepoem(a: Faixa, b: Faixa): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

/** `dentro` cabe inteiro em `fora`? */
export function contem(fora: Faixa, dentro: Faixa): boolean {
  return dentro.inicio >= fora.inicio && dentro.fim <= fora.fim;
}

export function duracao(faixa: Faixa): number {
  return faixa.fim - faixa.inicio;
}

/** Soma dos minutos disponíveis. Serve para "quantas horas você abriu". */
export function total(faixas: readonly Faixa[]): number {
  return normalizar(faixas).reduce((soma, faixa) => soma + duracao(faixa), 0);
}
