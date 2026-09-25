// Módulo à parte de `formato.ts` porque aquele traz o `luxon`, e componente de
// cliente que só precisa humanizar um enum não deve carregar a biblioteca.

/**
 * Último recurso para um código de máquina que chegou até a tela sem rótulo:
 * `alterar_status_parceiro` → "Alterar status parceiro". Feio, mas legível —
 * e nunca com sublinhado.
 */
export function humanizar(codigo: string): string {
  const texto = codigo.replace(/[_-]+/g, " ").trim().toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
