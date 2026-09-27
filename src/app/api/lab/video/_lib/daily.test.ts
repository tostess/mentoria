import { describe, expect, it } from "vitest";
import { clienteDaily, ErroDaily, type Sala } from "./daily";

/**
 * `garantirSala` contra um Daily falso que reproduz o que foi **medido** em
 * 27/09/2026 (docs/spike-video.md, pergunta 1): criação repetida responde 400
 * `invalid-request-error`, o mesmo código de nome inválido; sala inexistente
 * responde 404 `not-found`.
 */

type Chamada = { metodo: string; caminho: string };

function dailyFalso(opcoes: { atrasoMs?: number; statusCriacao?: number } = {}) {
  const salas = new Map<string, Sala>();
  const chamadas: Chamada[] = [];

  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    });

  const f: typeof fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    const caminho = url.pathname.replace(/^\/v1/, "");
    const metodo = init?.method ?? "GET";
    chamadas.push({ metodo, caminho });
    if (opcoes.atrasoMs) await new Promise((r) => setTimeout(r, opcoes.atrasoMs));

    if (metodo === "POST" && caminho === "/rooms") {
      if (opcoes.statusCriacao) return responder(opcoes.statusCriacao, { error: "server-error" });
      const { name } = JSON.parse(String(init?.body)) as { name: string };
      if (!/^[A-Za-z0-9_-]+$/.test(name)) {
        return responder(400, {
          error: "invalid-request-error",
          info: `${name} contains invalid characters`,
        });
      }
      // A checagem e a inserção são atômicas aqui, como no Daily: de duas
      // criações simultâneas, só uma vence.
      if (salas.has(name)) {
        return responder(400, {
          error: "invalid-request-error",
          info: `a room named ${name} already exists`,
        });
      }
      const sala: Sala = {
        id: crypto.randomUUID(),
        name,
        privacy: "private",
        url: `https://teste.daily.co/${name}`,
        created_at: new Date().toISOString(),
        config: {},
      };
      salas.set(name, sala);
      return responder(200, sala);
    }

    const leitura = caminho.match(/^\/rooms\/([^/]+)$/);
    if (metodo === "GET" && leitura) {
      const sala = salas.get(decodeURIComponent(leitura[1]));
      return sala
        ? responder(200, sala)
        : responder(404, { error: "not-found", info: `room ${leitura[1]} not found` });
    }

    return responder(500, { error: "server-error" });
  };

  return { f, salas, chamadas };
}

const nome = () => crypto.randomUUID();

describe("garantirSala", () => {
  it("cria a sala privada quando ela não existe", async () => {
    const daily = dailyFalso();
    const { garantirSala } = clienteDaily({ apiKey: "k", fetch: daily.f });
    const n = nome();

    const { sala, criada } = await garantirSala(n, { exp: 1 });

    expect(criada).toBe(true);
    expect(sala.name).toBe(n);
    expect(sala.privacy).toBe("private");
    expect(daily.chamadas).toEqual([{ metodo: "POST", caminho: "/rooms" }]);
  });

  it("trata 'já existe' como sucesso e devolve a sala que já estava lá", async () => {
    const daily = dailyFalso();
    const { garantirSala } = clienteDaily({ apiKey: "k", fetch: daily.f });
    const n = nome();

    const primeira = await garantirSala(n);
    const segunda = await garantirSala(n);

    expect(segunda.criada).toBe(false);
    expect(segunda.sala.id).toBe(primeira.sala.id);
    expect(daily.chamadas.map((c) => c.metodo)).toEqual(["POST", "POST", "GET"]);
  });

  it("de duas criações simultâneas, uma cria e a outra recebe a mesma sala", async () => {
    const daily = dailyFalso({ atrasoMs: 5 });
    const { garantirSala } = clienteDaily({ apiKey: "k", fetch: daily.f });
    const n = nome();

    const resultados = await Promise.all([garantirSala(n), garantirSala(n), garantirSala(n)]);

    expect(resultados.filter((r) => r.criada)).toHaveLength(1);
    expect(new Set(resultados.map((r) => r.sala.id)).size).toBe(1);
    expect(daily.salas.size).toBe(1);
  });

  it("não engole o 400 de verdade: nome inválido sobe como erro", async () => {
    const daily = dailyFalso();
    const { garantirSala } = clienteDaily({ apiKey: "k", fetch: daily.f });

    const erro = await garantirSala("com espaço").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDaily);
    expect((erro as ErroDaily).status).toBe(400);
    expect((erro as ErroDaily).info).toContain("invalid characters");
  });

  it("erro que não é 400 sobe sem a leitura de conferência", async () => {
    const daily = dailyFalso({ statusCriacao: 503 });
    const { garantirSala } = clienteDaily({ apiKey: "k", fetch: daily.f });

    const erro = await garantirSala(nome()).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDaily);
    expect((erro as ErroDaily).status).toBe(503);
    expect(daily.chamadas).toHaveLength(1);
  });

  it("manda a chave no cabeçalho e cria sempre privada", async () => {
    let cabecalho = "";
    let corpo = "";
    const f: typeof fetch = async (_url, init) => {
      cabecalho = new Headers(init?.headers).get("authorization") ?? "";
      corpo = String(init?.body);
      return new Response(JSON.stringify({ name: "x", config: {} }), { status: 200 });
    };

    await clienteDaily({ apiKey: "segredo", fetch: f }).garantirSala("x", { exp: 10 });

    expect(cabecalho).toBe("Bearer segredo");
    expect(JSON.parse(corpo)).toEqual({ name: "x", privacy: "private", properties: { exp: 10 } });
  });
});
