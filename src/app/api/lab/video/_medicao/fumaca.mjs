// SPIKE P5-0 — ferramenta de medição, roda na máquina de quem mede, nunca no
// app. JS puro para ficar fora do tsconfig; o Node 24 importa o `daily.ts` direto.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/fumaca.mjs
import { abrirAba, abrirChrome } from "./cdp.mjs";
import { agora, ate, daily, log, quem, SCRATCH } from "./comum.mjs";

const nome = `lab-fumaca-${agora()}`;
const { sala } = await daily.garantirSala(nome, { exp: agora() + 600 });
const token = await daily.emitirToken({ room_name: nome, user_name: "Fumaça", exp: agora() + 600, enable_prejoin_ui: false });
const { cdp, processo } = await abrirChrome(`${SCRATCH}/chrome-fumaca`);
const aba = await abrirAba(cdp, `${sala.url}?t=${token}`, "A", `${SCRATCH}/fotos`);
for (const s of [5, 10, 15]) {
  await ate(s);
  log("presença", await quem(nome), "| tela:", await aba.texto());
}
log(await aba.foto("fumaca"));
processo.kill();
await daily.apagarSala(nome);
process.exit(0);
