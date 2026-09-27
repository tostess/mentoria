// SPIKE P5-0 — ferramenta de medição, roda na máquina de quem mede, nunca no
// app. JS puro para ficar fora do tsconfig; o Node 24 importa o `daily.ts` direto.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/historico.mjs
import { daily } from "./comum.mjs";
const inicio = Number(process.argv[2]);
const ids = process.argv.slice(3);
for (const id of ids) {
  const nome = `lab-${id}-${inicio}`;
  const r = (await daily.reunioes(nome));
  console.log(`== ${id} (exp relativo ao início: ver log)`);
  for (const m of r.data) {
    console.log(` reunião início +${m.start_time - inicio}s duração ${m.duration}s ongoing=${m.ongoing}`);
    for (const p of m.participants.sort((a, b) => a.join_time - b.join_time)) console.log(` ${p.user_name.padEnd(32)} entrou +${p.join_time - inicio}s saiu +${p.join_time - inicio + p.duration}s`);
  }
}
const um = (await daily.reunioes(`lab-${ids[0]}-${inicio}`));
console.log("\nformato bruto de uma reunião:", JSON.stringify(um.data[0]).slice(0, 700));
process.exit(0);
