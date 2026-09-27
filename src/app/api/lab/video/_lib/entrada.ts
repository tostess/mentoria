/** Leitura do corpo JSON das rotas do lab — SPIKE P5-0. Sem `any`, sem biblioteca. */

export type Corpo = Record<string, unknown>;

export async function lerCorpo(request: Request): Promise<Corpo | null> {
  try {
    const corpo: unknown = await request.json();
    return typeof corpo === "object" && corpo !== null && !Array.isArray(corpo) ? (corpo as Corpo) : null;
  } catch {
    return null;
  }
}

export function texto(corpo: Corpo, campo: string): string | null {
  const v = corpo[campo];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function numero(corpo: Corpo, campo: string): number | null {
  const v = corpo[campo];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function booleano(corpo: Corpo, campo: string): boolean {
  return corpo[campo] === true;
}

/** Nome de sala aceito pelo Daily (medido: A-Z, a-z, 0-9, '-' e '_'). */
export function nomeDeSalaValido(nome: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(nome);
}

export const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

export function recusar(erro: string, status = 422): Response {
  return Response.json({ erro }, { status, headers: { "cache-control": "no-store" } });
}
