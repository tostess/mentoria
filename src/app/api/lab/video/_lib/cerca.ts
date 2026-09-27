/**
 * A cerca do laboratório de vídeo — SPIKE P5-0.
 *
 * Todo código de `src/app/lab/video/` e `src/app/api/lab/video/` responde 404
 * em produção. `VERCEL_ENV` e não `NODE_ENV`: o Preview também roda com
 * `NODE_ENV=production`, e é justamente no Preview que o spike precisa existir.
 * `VERCEL_ENV` é variável de sistema da Vercel, lida em tempo de execução.
 *
 * `lab.test.ts` confere por varredura que toda rota e toda página do lab
 * passam por aqui antes de fazer qualquer coisa.
 */

export function labAberto(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/** Para Route Handler: `const fechado = labFechado(); if (fechado) return fechado;` */
export function labFechado(): Response | null {
  if (labAberto()) return null;
  return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
}
