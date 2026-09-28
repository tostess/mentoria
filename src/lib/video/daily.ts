/**
 * Cliente mínimo da REST API do Daily.
 *
 * Puro de propósito: recebe a chave e o `fetch` por parâmetro, não lê variável
 * de ambiente nem importa `server-only`. É o que deixa o teste chamar a mesma
 * função que a rota chama, contra um Daily falso. Quem lê o segredo é
 * `video/index.ts`.
 *
 * Só o que a P5 usa: criar a sala, emitir token e ler quem entrou. Sem atualizar
 * sala nem expulsar — eram da extensão, que saiu do produto quando o spike mostrou
 * que a hora de expulsão é fixada na entrada de cada pessoa.
 *
 * Referência conferida em 27/09/2026 contra https://docs.daily.co/llms.txt, e o
 * formato de `/meetings` medido contra o domínio de desenvolvimento em 28/09.
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

/** `exp` e `nbf` são segundos Unix. */
export type PropriedadesSala = {
  exp?: number;
  nbf?: number;
  eject_at_room_exp?: boolean;
  max_participants?: number;
  enable_prejoin_ui?: boolean;
  lang?: string;
  geo?: string;
};

/**
 * Sem `eject_at_token_exp` nem `eject_after_elapsed`, e não por esquecimento: se
 * o token tiver qualquer propriedade de expulsão, as da sala são ignoradas para
 * aquele participante — e é a da sala que encerra a chamada.
 */
export type PropriedadesToken = {
  room_name: string;
  user_name: string;
  user_id: string;
  is_owner: boolean;
  nbf: number;
  exp: number;
  lang?: string;
  /**
   * Para onde o iframe vai quando a pessoa clica em sair. Só existe no token (na
   * sala é 400) e não age na expulsão pela expiração — medido, spike §6.
   */
  redirect_on_meeting_exit?: string;
};

/** Uma entrada na sala. `join_time` em segundos Unix, `duration` em segundos. */
export type ParticipanteDaReuniao = {
  user_id: string | null;
  participant_id: string;
  user_name: string | null;
  join_time: number;
  duration: number;
};

export type Reuniao = {
  id: string;
  room: string;
  start_time: number;
  duration: number;
  ongoing: boolean;
  participants: ParticipanteDaReuniao[];
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

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

/**
 * A resposta de `/meetings` validada campo a campo. É dela que sai a decisão
 * entre `done` e `no_show_*` — e com ela o estorno —, então entrada com campo
 * faltando é descartada em vez de virar presença inventada.
 */
export function lerReunioes(corpo: unknown): Reuniao[] {
  const dados = (corpo as { data?: unknown } | null)?.data;
  if (!Array.isArray(dados)) throw new ErroDaily(200, "resposta-inesperada", "sem `data` em /meetings");

  return dados.flatMap((bruto): Reuniao[] => {
    const r = (bruto ?? {}) as Record<string, unknown>;
    const inicio = numero(r.start_time);
    if (typeof r.id !== "string" || typeof r.room !== "string" || inicio === null) return [];
    const participantes = Array.isArray(r.participants) ? r.participants : [];
    return [
      {
        id: r.id,
        room: r.room,
        start_time: inicio,
        duration: numero(r.duration) ?? 0,
        ongoing: r.ongoing === true,
        participants: participantes.flatMap((p): ParticipanteDaReuniao[] => {
          const q = (p ?? {}) as Record<string, unknown>;
          const entrou = numero(q.join_time);
          const duracao = numero(q.duration);
          if (typeof q.participant_id !== "string" || entrou === null || duracao === null) return [];
          return [
            {
              user_id: textoOuNulo(q.user_id),
              participant_id: q.participant_id,
              user_name: textoOuNulo(q.user_name),
              join_time: entrou,
              duration: duracao,
            },
          ];
        }),
      },
    ];
  });
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
   * Medido no spike: de N criações simultâneas com o mesmo nome, exatamente uma
   * recebe 200 e as outras recebem **400 `invalid-request-error`** — o mesmo
   * código de nome inválido. O código não distingue "já existe" de "pedido
   * ruim", e o `info` é texto que a documentação manda não interpretar.
   *
   * Daí o desenho: tentar criar e, no 400, **perguntar** se a sala existe. Se
   * existe, quem perdeu a corrida ganhou a mesma sala. Se não existe, o 400 era
   * de verdade e sobe como veio. Criar primeiro porque, na primeira entrada da
   * sessão, o normal é a sala não existir: uma viagem em vez de duas.
   *
   * Sala existente volta como está, sem reaplicar `propriedades`.
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

  async function emitirToken(propriedades: PropriedadesToken): Promise<string> {
    const { token } = await json<{ token: string }>(
      await pedir("POST", "/meeting-tokens", { properties: propriedades }),
    );
    return token;
  }

  /**
   * Quem entrou na sala, entrada por entrada. Sala que nunca existiu responde
   * 200 com lista vazia (medido) — "ninguém entrou" não é erro.
   */
  async function reunioes(nome: string): Promise<Reuniao[]> {
    return lerReunioes(await json<unknown>(await pedir("GET", `/meetings?room=${encodeURIComponent(nome)}`)));
  }

  return { garantirSala, lerSala, emitirToken, reunioes };
}

export type ClienteDaily = ReturnType<typeof clienteDaily>;

/** Segundos Unix de um `Date`, que é o que o Daily espera em `nbf`/`exp`. */
export function segundos(instante: Date): number {
  return Math.floor(instante.getTime() / 1000);
}
