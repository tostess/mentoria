/**
 * Regras da recuperação de senha por e-mail ("Esqueceu a senha?").
 *
 * Módulo puro: a Server Action decide aqui e o teste confere sem rede.
 *
 * O link do e-mail passa pelo servidor de auth e chega a `/redefinir-senha`
 * com os tokens de uma sessão no fragmento. O `type=recovery` do fragmento é
 * texto que qualquer um escreve na barra, então não prova nada. O que prova é
 * o token assinado: sessão aberta por link de e-mail leva `amr` com método
 * `otp` e o instante da verificação (medido no `mentoria-dev` em 07/10/2026 —
 * o link de recuperação e o mágico dão o mesmo `otp`; a entrada por senha dá
 * `password`).
 *
 * Exigir `otp` recente é o que impede um cookie de sessão comum, roubado, de
 * trocar a senha sem saber a atual — a troca pelo menu da conta pede a senha
 * atual pelo mesmo motivo.
 */

/** Quanto tempo depois de abrir o link a pessoa tem para escolher a senha nova. */
export const RECUPERACAO_MINUTOS = 15;

type Amr = { method?: unknown; timestamp?: unknown };

/** A sessão nasceu de um link de e-mail aberto há menos de `RECUPERACAO_MINUTOS`? */
export function sessaoDeRecuperacao(amr: unknown, agora: Date): boolean {
  if (!Array.isArray(amr)) return false;
  const limite = agora.getTime() / 1000 - RECUPERACAO_MINUTOS * 60;
  return amr.some((item: Amr) => {
    if (typeof item !== "object" || item === null) return false;
    return item.method === "otp" && typeof item.timestamp === "number" && item.timestamp >= limite;
  });
}

/** O que o fragmento do link trouxe: os tokens, ou o erro de link vencido. */
export type FragmentoDoLink =
  | { tipo: "tokens"; accessToken: string; refreshToken: string }
  | { tipo: "erro" }
  | { tipo: "vazio" };

export function lerFragmento(hash: string): FragmentoDoLink {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (p.has("error") || p.has("error_code")) return { tipo: "erro" };
  const accessToken = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  if (accessToken && refreshToken) return { tipo: "tokens", accessToken, refreshToken };
  return { tipo: "vazio" };
}
