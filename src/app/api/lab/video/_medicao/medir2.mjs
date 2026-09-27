// SPIKE P5-0 — ferramenta de medição, roda na máquina de quem mede, nunca no
// app. JS puro para ficar fora do tsconfig; o Node 24 importa o `daily.ts` direto.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/medir2.mjs
// Segunda rodada: por que a extensão pela sala não pegou, e o que pega.
import { writeFileSync } from "node:fs";
import { abrirAba, abrirChrome, } from "./cdp.mjs";
import { ate, daily, log, quem, SCRATCH, T0 } from "./comum.mjs";

const inicio = Math.floor(T0 / 1000);
const FOTOS = `${SCRATCH}/fotos2`;
const { cdp, processo } = await abrirChrome(`${SCRATCH}/chrome-medir2`, 9334);
const salas = [];

async function sala(id, props) {
  const nome = `lab-${id}-${inicio}`;
  const { sala } = await daily.garantirSala(nome, { lang: "pt-BR", ...props });
  salas.push(nome);
  log(`[${id}] sala`, JSON.stringify(sala.config));
  return sala;
}

async function url(salaUrl, nome, props) {
  const token = await daily.emitirToken({
    room_name: salaUrl.split("/").pop() ,
    user_name: nome,
    enable_prejoin_ui: false,
    lang: "pt-BR",
    ...props,
  });
  return `${salaUrl}?t=${token}`;
}

async function sonda(id, nomeSala, aba, foto) {
  const partes = [`[${id}] presença ${await quem(nomeSala)}`];
  if (aba) partes.push(`| tela ${aba.rotulo}: ${(await aba.texto()).slice(0, 140)}`);
  if (aba && foto) await aba.foto(foto);
  log(partes.join(" "));
}

function vigiar(id, nomeSala, ateS, passo = 5) {
  return (async () => {
    for (let s = passo; s <= ateS; s += passo) {
      await ate(s);
      log(`[${id}] presença ${await quem(nomeSala)}`);
    }
  })();
}

/** Clica no primeiro botão cujo texto contém `rotulo`, na aba. */
async function clicar(aba, rotulo) {
  return aba.avaliar(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes(${JSON.stringify(rotulo)})); if (!b) return 'sem botão'; b.click(); return 'clicado'; })()`,
  );
}

const tarefas = [];

// E1 — estende a sala; só o Profissional reentra com token novo.
tarefas.push((async () => {
  const s = await sala("e1reentra", { exp: inicio + 90, eject_at_room_exp: true });
  const a = await abrirAba(cdp, await url(s.url, "E1 Parceiro", { exp: inicio + 90, is_owner: true, user_id: "e1-parceiro" }), "E1-parceiro", FOTOS);
  const b = await abrirAba(cdp, await url(s.url, "E1 Profissional", { exp: inicio + 90, user_id: "e1-prof" }), "E1-prof", FOTOS);
  const v = vigiar("e1reentra", s.name, 250);
  await ate(45);
  await daily.atualizarSala(s.name, { exp: inicio + 210 });
  log("[e1reentra] sala estendida para +210");
  await ate(55);
  await b.navegar(await url(s.url, "E1 Profissional", { exp: inicio + 210, user_id: "e1-prof" }));
  log("[e1reentra] Profissional reentra com token novo");
  await ate(75);
  await sonda("e1reentra", s.name, a, "e1-parceiro-75s");
  await sonda("e1reentra", s.name, b, "e1-prof-75s");
  await ate(105);
  await sonda("e1reentra", s.name, a, "e1-parceiro-105s");
  await sonda("e1reentra", s.name, b, "e1-prof-105s");
  await ate(200);
  await sonda("e1reentra", s.name, b, "e1-prof-200s");
  await ate(230);
  await sonda("e1reentra", s.name, b, "e1-prof-230s");
  await v;
})());

// E2 — desliga a expulsão da sala no meio da chamada.
tarefas.push((async () => {
  const s = await sala("e2desliga", { exp: inicio + 90, eject_at_room_exp: true });
  const a = await abrirAba(cdp, await url(s.url, "E2 Profissional", { exp: inicio + 600 }), "E2", FOTOS);
  const v = vigiar("e2desliga", s.name, 150);
  await ate(45);
  const r = await daily.atualizarSala(s.name, { exp: inicio + 600, eject_at_room_exp: false });
  log("[e2desliga] expulsão desligada e exp +600:", JSON.stringify(r.config));
  await ate(75);
  await sonda("e2desliga", s.name, a, "e2-75s");
  await ate(105);
  await sonda("e2desliga", s.name, a, "e2-105s");
  await v;
})());

// E3 — fim decidido pelo servidor: sala sem expulsão, POST /eject por user_id.
tarefas.push((async () => {
  const s = await sala("e3servidor", { exp: inicio + 600 });
  const a = await abrirAba(cdp, await url(s.url, "E3 Parceiro", { exp: inicio + 600, is_owner: true, user_id: "e3-parceiro" }), "E3-parceiro", FOTOS);
  const b = await abrirAba(cdp, await url(s.url, "E3 Profissional", { exp: inicio + 600, user_id: "e3-prof" }), "E3-prof", FOTOS);
  const v = vigiar("e3servidor", s.name, 120);
  await ate(60);
  const antes = Date.now();
  const r2 = await daily.ejetar(s.name, { user_ids: ["e3-parceiro", "e3-prof"] }).then((x) => JSON.stringify(x), (e) => String(e));
  log(`[e3servidor] eject por user_ids em ${Date.now() - antes} ms:`, r2);
  await ate(63);
  await sonda("e3servidor", s.name, b, "e3-prof-3s-depois");
  await ate(70);
  await sonda("e3servidor", s.name, a, "e3-parceiro-10s-depois");
  // Reentrar depois de expulso, com token ainda válido.
  await b.navegar(await url(s.url, "E3 Profissional", { exp: inicio + 600, user_id: "e3-prof" }));
  await ate(90);
  await sonda("e3servidor", s.name, b, "e3-prof-reentrou");
  await v;
})());

// E4 — nbf: "Tentar novamente" e navegar de novo com o token, depois do nbf.
tarefas.push((async () => {
  const s = await sala("e4nbf", { exp: inicio + 600 });
  const u = await url(s.url, "E4 Profissional", { nbf: inicio + 40, exp: inicio + 600 });
  const uB = await url(s.url, "E4 Segundo", { nbf: inicio + 40, exp: inicio + 600 });
  const a = await abrirAba(cdp, u, "E4-botao", FOTOS);
  const b = await abrirAba(cdp, uB, "E4-navega", FOTOS);
  await ate(20);
  await sonda("e4nbf", s.name, a);
  await ate(50);
  log("[e4nbf] botão:", await clicar(a, "Tentar novamente"));
  await b.navegar(uB);
  log("[e4nbf] segunda aba navega de novo para a mesma URL com token");
  await ate(70);
  await sonda("e4nbf", s.name, a, "e4-depois-do-botao");
  await sonda("e4nbf", s.name, b, "e4-depois-de-navegar");
})());

const resultados = await Promise.allSettled(tarefas);
resultados.forEach((r, i) => r.status === "rejected" && log(`cenário ${i + 1} falhou:`, r.reason));

const historico = {};
for (const nome of salas) historico[nome] = await daily.reunioes(nome).catch((e) => String(e));
writeFileSync(`${SCRATCH}/reunioes2.json`, JSON.stringify(historico, null, 1));
log("histórico salvo em reunioes2.json");

processo.kill();
process.exit(0);
