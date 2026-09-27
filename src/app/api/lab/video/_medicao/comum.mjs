// SPIKE P5-0 — ferramenta de medição, roda na máquina de quem mede, nunca no
// app. JS puro para ficar fora do tsconfig; o Node 24 importa o `daily.ts` direto.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/comum.mjs
import { readFileSync } from "node:fs";
import { clienteDaily } from "../_lib/daily.ts";

export const RAIZ = process.cwd();
export const SCRATCH = `${(await import("node:os")).tmpdir()}/mentoria-medicao-video`;

const env = readFileSync(`${RAIZ}/.env.local`, "utf8");
export const chave = env.match(/^DAILY_API_KEY=(.+)$/m)?.[1]?.trim();
if (!chave) throw new Error("sem chave");

export const daily = clienteDaily({ apiKey: chave });

export const agora = () => Math.floor(Date.now() / 1000);
export const T0 = Date.now();
export const t = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6);
export const log = (...a) => console.log(`t=+${t()}s`, ...a);
export const esperar = (s) => new Promise((r) => setTimeout(r, s * 1000));
export const ate = (s) => esperar(Math.max(0, s - (Date.now() - T0) / 1000));

export async function quem(sala) {
  try {
    const p = await daily.presenca(sala);
    return `${p.total_count} [${p.data.map((d) => d.userName).join(", ")}]`;
  } catch (e) {
    return `erro ${(e).message}`;
  }
}
