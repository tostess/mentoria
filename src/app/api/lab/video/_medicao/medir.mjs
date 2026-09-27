// SPIKE P5-0 — ferramenta de medição, roda na máquina de quem mede, nunca no
// app. JS puro para ficar fora do tsconfig; o Node 24 importa o `daily.ts` direto.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/medir.mjs
// Perguntas 2 e 3 do spike: janela do token, expulsão e extensão.
// Seis cenários em paralelo, cada um numa sala. Presença pela REST a cada 10 s.
import { writeFileSync } from "node:fs";
import { abrirAba, abrirChrome, } from "./cdp.mjs";
import { ate, daily, log, quem, SCRATCH, T0 } from "./comum.mjs";

const inicio = Math.floor(T0 / 1000);
const FOTOS = `${SCRATCH}/fotos`;
const { cdp, processo } = await abrirChrome(`${SCRATCH}/chrome-medir`);
const salas = [];

async function sala(id, props) {
  const nome = `lab-${id}-${inicio}`;
  const { sala } = await daily.garantirSala(nome, { lang: "pt-BR", ...props });
  salas.push(nome);
  log(`[${id}] sala criada`, JSON.stringify(sala.config));
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
  if (aba) partes.push(`| tela ${aba.rotulo}: ${await aba.texto()}`);
  if (aba && foto) partes.push(`| foto ${await aba.foto(foto)}`);
  log(partes.join(" "));
}

function vigiar(id, nomeSala, ateS, passo = 10) {
  return (async () => {
    for (let s = passo; s <= ateS; s += passo) {
      await ate(s);
      log(`[${id}] presença ${await quem(nomeSala)}`);
    }
  })();
}

const tarefas = [];

// S1 — entrar antes do nbf do token
tarefas.push((async () => {
  const s = await sala("s1nbf", { exp: inicio + 600 });
  const a = await abrirAba(cdp, await url(s.url, "S1 Profissional", { nbf: inicio + 75, exp: inicio + 600 }), "S1", FOTOS);
  await ate(20); await sonda("s1nbf", s.name, a, "s1-antes-do-nbf");
  await ate(95); await sonda("s1nbf", s.name, a);
  await ate(100); await a.recarregar(); log("[s1nbf] aba recarregada depois do nbf");
  await ate(120); await sonda("s1nbf", s.name, a, "s1-recarregado-depois-do-nbf");
})());

// S2 — token vence com a pessoa dentro, SEM eject_at_token_exp; e reentrar depois
tarefas.push((async () => {
  const s = await sala("s2tokexp", { exp: inicio + 600 });
  const u = await url(s.url, "S2 Profissional", { exp: inicio + 45 });
  const a = await abrirAba(cdp, u, "S2", FOTOS);
  const v = vigiar("s2tokexp", s.name, 150);
  await ate(100);
  const b = await abrirAba(cdp, u, "S2-reentrada", FOTOS);
  log("[s2tokexp] segunda aba com o mesmo token, já vencido");
  await ate(120); await sonda("s2tokexp", s.name, b, "s2-reentrar-com-token-vencido");
  await sonda("s2tokexp", s.name, a, "s2-quem-ficou");
  await v;
})());

// S3 — token vence COM eject_at_token_exp
tarefas.push((async () => {
  const s = await sala("s3tokeje", { exp: inicio + 600 });
  const a = await abrirAba(cdp, await url(s.url, "S3 Profissional", { exp: inicio + 45, eject_at_token_exp: true }), "S3", FOTOS);
  const v = vigiar("s3tokeje", s.name, 120, 5);
  await ate(35); await sonda("s3tokeje", s.name, a, "s3-antes-de-vencer");
  await ate(70); await sonda("s3tokeje", s.name, a, "s3-depois-de-vencer");
  await v;
})());

// S4 — controle: sala vence com eject_at_room_exp, ninguém estende
tarefas.push((async () => {
  const s = await sala("s4sala", { exp: inicio + 90, eject_at_room_exp: true });
  const p = await abrirAba(cdp, await url(s.url, "S4 Parceiro", { exp: inicio + 90, is_owner: true }), "S4-parceiro", FOTOS);
  const r = await abrirAba(cdp, await url(s.url, "S4 Profissional", { exp: inicio + 90 }), "S4-prof", FOTOS);
  const v = vigiar("s4sala", s.name, 150, 5);
  await ate(40); await sonda("s4sala", s.name, r, "s4-aos-40s");
  await ate(75); await sonda("s4sala", s.name, r, "s4-aos-75s");
  await ate(100); await sonda("s4sala", s.name, r, "s4-depois-do-fim");
  await sonda("s4sala", s.name, p, "s4-parceiro-depois-do-fim");
  await v;
})());

// S5 — hipótese da pergunta 3: sala vence com ejeção, e é estendida no meio
tarefas.push((async () => {
  const s = await sala("s5estende", { exp: inicio + 90, eject_at_room_exp: true });
  const p = await abrirAba(cdp, await url(s.url, "S5 Parceiro", { exp: inicio + 90, is_owner: true }), "S5-parceiro", FOTOS);
  const r = await abrirAba(cdp, await url(s.url, "S5 Profissional", { exp: inicio + 90 }), "S5-prof", FOTOS);
  const v = vigiar("s5estende", s.name, 260, 5);
  await ate(40); await sonda("s5estende", s.name, r, "s5-antes-de-estender");
  await ate(45);
  const antes = Date.now();
  const nova = await daily.atualizarSala(s.name, { exp: inicio + 210 });
  log(`[s5estende] ESTENDIDA em ${Date.now() - antes} ms: exp ${inicio + 90} → ${nova.config.exp} (+120 s)`);
  await ate(60); await sonda("s5estende", s.name, r, "s5-depois-de-estender");
  await ate(100); await sonda("s5estende", s.name, r, "s5-passou-o-fim-original");
  await ate(120); await r.recarregar(); log("[s5estende] Profissional recarrega (reconexão) com token vencido");
  await ate(140); await sonda("s5estende", s.name, r, "s5-reconectar-token-velho");
  await ate(150);
  await r.navegar(await url(s.url, "S5 Profissional (token novo)", { exp: inicio + 210 }));
  log("[s5estende] Profissional entra com token NOVO (exp = fim estendido)");
  await ate(170); await sonda("s5estende", s.name, r, "s5-token-novo");
  await ate(200); await sonda("s5estende", s.name, p, "s5-perto-do-fim-novo");
  await ate(225); await sonda("s5estende", s.name, p, "s5-depois-do-fim-novo");
  await v;
})());

// S6 — sala vence SEM eject_at_room_exp
tarefas.push((async () => {
  const s = await sala("s6salasemeje", { exp: inicio + 60 });
  await abrirAba(cdp, await url(s.url, "S6 Profissional", { exp: inicio + 600 }), "S6", FOTOS);
  const v = vigiar("s6salasemeje", s.name, 130);
  await ate(90);
  const b = await abrirAba(cdp, await url(s.url, "S6 Segundo", { exp: inicio + 600 }).catch((e) => { log("[s6salasemeje] token recusado:", (e).message); return "about:blank"; }), "S6-segundo", FOTOS);
  await ate(110); await sonda("s6salasemeje", s.name, b, "s6-entrar-depois-do-exp-da-sala");
  await v;
})());

const resultados = await Promise.allSettled(tarefas);
resultados.forEach((r, i) => r.status === "rejected" && log(`cenário ${i + 1} falhou:`, r.reason));

// Histórico exato de entrada e saída, pela REST de reuniões.
const historico = {};
for (const nome of salas) historico[nome] = await daily.reunioes(nome).catch((e) => String(e));
writeFileSync(`${SCRATCH}/reunioes.json`, JSON.stringify(historico, null, 1));
log("histórico salvo em reunioes.json");

processo.kill();
process.exit(0);
