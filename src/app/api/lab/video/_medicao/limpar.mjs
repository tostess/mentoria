// SPIKE P5-0 — ferramenta de medição. Apaga todas as salas do domínio Daily.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/limpar.mjs
import { chave, daily } from "./comum.mjs";

const r = await (await fetch("https://api.daily.co/v1/rooms?limit=100", { headers: { authorization: `Bearer ${chave}` } })).json();
for (const s of r.data) await daily.apagarSala(s.name);
console.log(`apagadas ${r.data.length} salas`);
process.exit(0);
