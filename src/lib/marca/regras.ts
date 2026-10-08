import { contraste, type CorDaMarca, type Theme } from "@/lib/theme";

/**
 * Regras puras da marca da empresa (F4b) — a tela e a ação usam as mesmas.
 * Sem banco e sem React.
 */

/** Nome de gente para cada cor do ajuste fino, na ordem em que a tela mostra. */
export const ROTULO_DA_COR: Record<CorDaMarca, string> = {
  ink: "Texto",
  stone: "Texto secundário",
  stoneDark: "Etiqueta",
  deep: "Accent escuro",
  mist: "Fundo da página",
  white: "Cartão",
  blush: "Fundo suave",
  line: "Borda",
  line2: "Borda de campo",
  muted: "Rótulo discreto",
  faint: "Ícone apagado",
  pale: "Marcador apagado",
  ghost: "Traço apagado",
};

/** O mínimo da WCAG para texto corrido. */
export const CONTRASTE_DE_TEXTO = 4.5;
/** O mínimo da WCAG para texto grande e elemento de interface — botão, borda de foco. */
export const CONTRASTE_DE_INTERFACE = 3;

/**
 * O que impede salvar: texto ilegível. Uma marca bonita com o texto sumindo no
 * fundo é defeito, não gosto — e quem descobre é o colaborador, não a operadora.
 */
export function problemasDeLeitura(tema: Theme): string[] {
  const problemas: string[] = [];
  if (contraste(tema.ink, tema.white) < CONTRASTE_DE_TEXTO) {
    problemas.push("O texto fica ilegível sobre o cartão. Escureça o texto ou clareie o cartão.");
  }
  if (contraste(tema.ink, tema.mist) < CONTRASTE_DE_TEXTO) {
    problemas.push("O texto fica ilegível sobre o fundo da página. Escureça o texto ou clareie o fundo.");
  }
  return problemas;
}

/**
 * O que salva, mas merece aviso: a cor principal aparece em botão, link e
 * item ativo, e um tom claro demais some contra o cartão. A marca da empresa
 * às vezes é amarela — a decisão fica com a operadora.
 */
export function avisosDeContraste(tema: Theme): string[] {
  const avisos: string[] = [];
  if (contraste(tema.accent, tema.white) < CONTRASTE_DE_INTERFACE) {
    avisos.push("A cor principal tem pouco contraste com o cartão: links e bordas de foco vão aparecer pouco.");
  }
  if (contraste(tema.stone, tema.white) < CONTRASTE_DE_INTERFACE) {
    avisos.push("O texto secundário tem pouco contraste com o cartão.");
  }
  return avisos;
}

/**
 * Endereço do logotipo: só `https`, porque vai num `<img>` em toda tela da
 * empresa, e `http` numa página `https` é bloqueado pelo navegador sem erro
 * nenhum na nossa ponta — o logotipo só não aparece.
 */
export function logotipoValido(endereco: string): boolean {
  try {
    const url = new URL(endereco);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}
