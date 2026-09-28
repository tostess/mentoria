import { describe, expect, it } from "vitest";
import { clienteDaily, ErroDaily, lerReunioes, type Sala } from "./daily";

/**
 * O cliente contra um Daily falso que reproduz o que foi **medido** no spike
 * (docs/spike-video.md): criação repetida responde 400 `invalid-request-error`,
 * o mesmo código de nome inválido; sala inexistente responde 404 `not-found`;
 * `/meetings` de sala que nunca existiu responde 200 com lista vazia.
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

    if (metodo === "GET" && caminho === "/meetings") return responder(200, { total_count: 0, data: [] });

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

  it("de três criações simultâneas, uma cria e as outras recebem a mesma sala", async () => {
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

describe("reunioes", () => {
  it("sala que nunca existiu é lista vazia, não erro", async () => {
    const daily = dailyFalso();
    const lista = await clienteDaily({ apiKey: "k", fetch: daily.f }).reunioes(nome());
    expect(lista).toEqual([]);
  });

  it("lê o formato medido contra o domínio de desenvolvimento", () => {
    const corpo = {
      total_count: 1,
      data: [
        {
          id: "04a7e183-9157-4dbd-9ca6-005c0ebe5eed",
          room: "sala",
          start_time: 1790549611,
          duration: 5,
          ongoing: false,
          max_participants: 1,
          participants: [
            {
              user_id: null,
              participant_id: "bb676cda-8cfc-4fd3-8667-0c12847b0c83",
              user_name: "Aviso 3",
              join_time: 1790549611,
              duration: 5,
            },
          ],
        },
      ],
    };

    expect(lerReunioes(corpo)).toEqual([
      {
        id: "04a7e183-9157-4dbd-9ca6-005c0ebe5eed",
        room: "sala",
        start_time: 1790549611,
        duration: 5,
        ongoing: false,
        participants: [
          {
            user_id: null,
            participant_id: "bb676cda-8cfc-4fd3-8667-0c12847b0c83",
            user_name: "Aviso 3",
            join_time: 1790549611,
            duration: 5,
          },
        ],
      },
    ]);
  });

  it("descarta entrada sem horário em vez de inventar presença", () => {
    const lista = lerReunioes({
      data: [
        {
          id: "r",
          room: "sala",
          start_time: 1,
          participants: [
            { user_id: "a", participant_id: "p1", join_time: 10, duration: 60 },
            { user_id: "b", participant_id: "p2", duration: 60 },
          ],
        },
      ],
    });

    expect(lista[0].participants.map((p) => p.user_id)).toEqual(["a"]);
  });

  it("resposta sem `data` é erro, não 'ninguém entrou'", () => {
    expect(() => lerReunioes({ error: "x" })).toThrow(ErroDaily);
  });
});
