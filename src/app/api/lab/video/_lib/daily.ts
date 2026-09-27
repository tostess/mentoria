/**
 * Cliente mínimo da REST API do Daily — SPIKE P5-0, descartável.
 *
 * Puro de propósito: recebe a chave e o `fetch` por parâmetro, não lê variável
 * de ambiente nem importa `server-only`. É o que deixa o teste unitário e o
 * script de medição (que roda em `node` direto, por *type stripping*) chamarem
 * **a mesma** função que a rota chama. Quem lê o segredo é `servidor.ts`.
 *
 * Só sintaxe TypeScript apagável e nenhum `import`: o Node 24 executa este
 * arquivo sem compilação.
 *
 * Referência conferida em 27/09/2026 contra https://docs.daily.co/llms.txt.
 */

export const DAILY_API = "https://api.daily.co/v1";

/** Sala como a API devolve. `config` varia com o que foi pedido. */
export type Sala = {
  id: string;
  name: string;
  privacy: string;
  url: string;
  created_at: string;
  config: Record<string, unknown>;
};

/**
 * Propriedades de sala usadas no spike. `exp` e `nbf` são segundos Unix.
 * `eject_at_room_exp` é a hipótese da pergunta 3: o fim da sessão vive na
 * sala, e prorrogar a sala prorroga a sessão.
 */
export type PropriedadesSala = {
  exp?: number;
  nbf?: number;
  eject_at_room_exp?: boolean;
  eject_after_elapsed?: number;
  enable_prejoin_ui?: boolean;
  enable_chat?: boolean;
  max_participants?: number;
  lang?: string;
};

/**
 * Propriedades de token usadas no spike. Atenção ao que a documentação diz: se
 * o token tiver `eject_at_token_exp` **ou** `eject_after_elapsed`, as
 * propriedades de expulsão da sala são ignoradas para aquele participante.
 */
export type PropriedadesToken = {
  room_name: string;
  user_name?: string;
  user_id?: string;
  is_owner?: boolean;
  nbf?: number;
  exp?: number;
  eject_at_token_exp?: boolean;
  eject_after_elapsed?: number;
  enable_prejoin_ui?: boolean;
  lang?: string;
};

export type Presenca = {
  total_count: number;
  data: Array<{
    id: string;
    userId: string | null;
    userName: string | null;
    joinTime: string;
    duration: number;
    room?: string;
  }>;
};

/**
 * Erro da API. `tipo` é o campo `error` (estável, documentado); `info` é texto
 * de depuração que o Daily avisa que pode mudar — nunca decidir por ele.
 */
export class ErroDaily extends Error {
  readonly status: number;
  readonly tipo: string;
  readonly info: string;

  constructor(status: number, tipo: string, info: string) {
    super(`Daily ${status} ${tipo}: ${info}`);
    this.name = "ErroDaily";
    this.status = status;
    this.tipo = tipo;
    this.info = info;
  }
}

type Fetch = typeof fetch;

export type OpcoesCliente = {
  apiKey: string;
  fetch?: Fetch;
  base?: string;
};

async function lerErro(resposta: Response): Promise<ErroDaily> {
  let tipo = "desconhecido";
  let info = "";
  try {
    const corpo: unknown = await resposta.json();
    if (typeof corpo === "object" && corpo !== null) {
      const c = corpo as { error?: unknown; info?: unknown };
      if (typeof c.error === "string") tipo = c.error;
      if (typeof c.info === "string") info = c.info;
    }
  } catch {
    // corpo vazio ou não-JSON: fica o status
  }
  return new ErroDaily(resposta.status, tipo, info);
}

export function clienteDaily(opcoes: OpcoesCliente) {
  const base = opcoes.base ?? DAILY_API;
  const f: Fetch = opcoes.fetch ?? fetch;
  const cabecalhos = {
    authorization: `Bearer ${opcoes.apiKey}`,
    "content-type": "application/json",
  };

  async function pedir(metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
    return f(`${base}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: "no-store",
    });
  }

  async function json<T>(resposta: Response): Promise<T> {
    if (!resposta.ok) throw await lerErro(resposta);
    return (await resposta.json()) as T;
  }

  /** A sala, ou `null` se não existe. */
  async function lerSala(nome: string): Promise<Sala | null> {
    const resposta = await pedir("GET", `/rooms/${encodeURIComponent(nome)}`);
    if (resposta.status === 404) return null;
    return json<Sala>(resposta);
  }

  /**
   * Cria a sala privada `nome`, ou devolve a que já existe.
   *
   * Medido em 27/09/2026 (pergunta 1): de N criações simultâneas com o mesmo
   * nome, exatamente uma recebe 200 e as outras recebem **400
   * `invalid-request-error`** com `info: "a room named … already exists"`. O
   * mesmo 400 com o mesmo `error` vem para nome inválido — então o código de
   * erro não distingue "já existe" de "pedido ruim", e o `info` é texto que a
   * documentação diz para não interpretar.
   *
   * Daí o desenho: tentar criar e, no 400, **perguntar** se a sala existe. Se
   * existe, quem perdeu a corrida ganhou a mesma sala — sucesso, com
   * `criada: false`. Se não existe, o 400 era de verdade e sobe como veio.
   *
   * Criar primeiro (e não ler primeiro) porque o caso comum, na primeira
   * entrada da sessão, é a sala não existir: uma viagem em vez de duas.
   *
   * Sala existente é devolvida como está, **sem** reaplicar `propriedades`:
   * quem precisa garantir `exp` atualizado (a extensão) faz isso de propósito,
   * com `atualizarSala`, e não por efeito colateral de uma entrada.
   */
  async function garantirSala(
    nome: string,
    propriedades: PropriedadesSala = {},
  ): Promise<{ sala: Sala; criada: boolean }> {
    const resposta = await pedir("POST", "/rooms", {
      name: nome,
      privacy: "private",
      properties: propriedades,
    });

    if (resposta.ok) return { sala: (await resposta.json()) as Sala, criada: true };

    const erro = await lerErro(resposta);
    if (erro.status !== 400) throw erro;

    const existente = await lerSala(nome);
    if (existente === null) throw erro;
    return { sala: existente, criada: false };
  }

  /** `POST /rooms/:name` — troca só as propriedades passadas. */
  async function atualizarSala(nome: string, propriedades: PropriedadesSala): Promise<Sala> {
    return json<Sala>(
      await pedir("POST", `/rooms/${encodeURIComponent(nome)}`, { properties: propriedades }),
    );
  }

  async function apagarSala(nome: string): Promise<void> {
    const resposta = await pedir("DELETE", `/rooms/${encodeURIComponent(nome)}`);
    if (!resposta.ok && resposta.status !== 404) throw await lerErro(resposta);
  }

  async function emitirToken(propriedades: PropriedadesToken): Promise<string> {
    const { token } = await json<{ token: string }>(
      await pedir("POST", "/meeting-tokens", { properties: propriedades }),
    );
    return token;
  }

  /** Quem está na sala agora. Não depende de webhook nem de plano pago. */
  async function presenca(nome: string): Promise<Presenca> {
    return json<Presenca>(await pedir("GET", `/rooms/${encodeURIComponent(nome)}/presence`));
  }

  /** Histórico de reuniões da sala, com participantes e duração. */
  async function reunioes(nome: string): Promise<unknown> {
    return json<unknown>(await pedir("GET", `/meetings?room=${encodeURIComponent(nome)}`));
  }

  /**
   * Tira gente da chamada agora. `user_ids` é o `user_id` posto no token — o
   * servidor sabe quem expulsar sem consultar presença antes.
   */
  async function ejetar(nome: string, alvo: { ids?: string[]; user_ids?: string[] }): Promise<unknown> {
    return json<unknown>(await pedir("POST", `/rooms/${encodeURIComponent(nome)}/eject`, alvo));
  }

  return {
    garantirSala,
    lerSala,
    atualizarSala,
    apagarSala,
    emitirToken,
    presenca,
    reunioes,
    ejetar,
  };
}

export type ClienteDaily = ReturnType<typeof clienteDaily>;

/** Segundos Unix de um `Date`, que é o que o Daily espera em `nbf`/`exp`. */
export function segundos(instante: Date): number {
  return Math.floor(instante.getTime() / 1000);
}
