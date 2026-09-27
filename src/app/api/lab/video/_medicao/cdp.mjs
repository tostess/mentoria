// SPIKE P5-0 — ferramenta de medição, roda na máquina de quem mede, nunca no
// app. JS puro para ficar fora do tsconfig; o Node 24 importa o `daily.ts` direto.
// Uso: node --no-warnings src/app/api/lab/video/_medicao/cdp.mjs
// Chrome headless por CDP, sem dependência. Participantes falsos para o spike.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

                                                                              

export class Cdp {
  ws;
  id = 0;
  pendentes = new Map();
  ouvintes = [];

  constructor(ws) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.id !== undefined) {
        const p = this.pendentes.get(m.id);
        this.pendentes.delete(m.id);
        if (m.error) p?.reject(new Error(JSON.stringify(m.error)));
        else p?.resolve(m.result);
      } else {
        for (const o of this.ouvintes) o(m);
      }
    });
  }

  static async conectar(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, erro) => {
      ws.addEventListener("open", () => ok());
      ws.addEventListener("error", () => erro(new Error("ws")));
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pendentes.set(id, { resolve: resolve, reject }));
  }
}

export async function abrirChrome(dir, porta = 9333) {
  mkdirSync(dir, { recursive: true });
  const processo = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${porta}`,
      `--user-data-dir=${dir}`,
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=1280,800",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let versao = null;
  for (let i = 0; i < 50 && !versao; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      versao = (await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json());
    } catch {
      /* ainda subindo */
    }
  }
  if (!versao) throw new Error("chrome não subiu");
  return { cdp: await Cdp.conectar(versao.webSocketDebuggerUrl), processo };
}

                   
                 
                               
                                              
                                          
                                          
                                  
                              
  

export async function abrirAba(cdp, url, rotulo, pastaFotos) {
  const { browserContextId } = await cdp.send("Target.createBrowserContext");
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  mkdirSync(pastaFotos, { recursive: true });

  return {
    rotulo,
    async texto() {
      try {
        const r = await cdp.send(
          "Runtime.evaluate",
          { expression: "document.body ? document.body.innerText : ''", returnByValue: true },
          sessionId,
        );
        return (r.result.value ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
      } catch (e) {
        return `(erro lendo texto: ${(e).message.slice(0, 80)})`;
      }
    },
    async avaliar(expr) {
      const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId);
      return r.result.value;
    },
    async foto(nome) {
      const r = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
      const arquivo = join(pastaFotos, `${nome}.png`);
      writeFileSync(arquivo, Buffer.from(r.data, "base64"));
      return arquivo;
    },
    async navegar(u) {
      await cdp.send("Page.navigate", { url: u }, sessionId);
    },
    async recarregar() {
      await cdp.send("Page.reload", {}, sessionId);
    },
    async fechar() {
      await cdp.send("Target.closeTarget", { targetId });
    },
  };
}
