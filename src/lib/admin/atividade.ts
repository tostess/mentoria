import type { NomeIcone } from "@/components/ui/icones";
import { humanizar } from "@/lib/humanizar";
import { cap, countFichas, type Terms } from "@/lib/terms";

/**
 * O catálogo das ações auditadas — invariante 12 vista do lado de quem lê.
 *
 * `audit_logs.action` guarda um código estável (`alocar_fichas`) porque é
 * chave de consulta e não pode mudar quando o texto da tela mudar. Mas o
 * código é do banco, não da pessoa: nenhum sublinhado chega à interface. Cada
 * código tem aqui a frase que o traduz, escrita com os termos da empresa — o
 * "Parceiro" da frase é o `t.partner`, nunca literal.
 *
 * `AcaoAuditada` é derivado deste objeto e é o tipo que `registrarAuditoria`
 * aceita. Criar uma ação nova sem escrever a frase dela deixa de compilar, e é
 * esse o ponto: o painel nunca mais mostra código cru por esquecimento.
 *
 * Puro: sem banco e sem React. O componente monta a frase a partir das partes.
 */

/** Um pedaço da frase. `forte` marca nome próprio e quantidade. */
export type Parte = { texto: string; forte?: boolean };

export type Tom = "accent" | "gold" | "neutral" | "bad";

export type EventoDeAtividade = {
  acao: string;
  /** Nome de quem fez, ou null quando foi o trabalho agendado. */
  autor: string | null;
  /** Nome da pessoa afetada, quando a ação é sobre alguém. */
  alvo: string | null;
  /** Nome da empresa afetada, quando há uma. */
  empresa: string | null;
  antes: unknown;
  depois: unknown;
};

type Definicao = {
  icone: (ev: EventoDeAtividade) => NomeIcone;
  tom: (ev: EventoDeAtividade) => Tom;
  /** Predicado da frase — o sujeito (quem fez) é posto por `descrever`. */
  predicado: (ev: EventoDeAtividade, t: Terms) => Parte[];
};

const forte = (texto: string): Parte => ({ texto, forte: true });
const fraco = (texto: string): Parte => ({ texto });

function campo(valor: unknown, chave: string): unknown {
  if (typeof valor !== "object" || valor === null) return undefined;
  return (valor as Record<string, unknown>)[chave];
}

function numero(valor: unknown, chave: string): number | null {
  const v = campo(valor, chave);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function textoDe(valor: unknown, chave: string): string | null {
  const v = campo(valor, chave);
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Nome do alvo, ou o nome gravado no `after` quando o perfil sumiu. */
function nomeDoAlvo(ev: EventoDeAtividade): string {
  return ev.alvo ?? textoDe(ev.depois, "nome") ?? "alguém";
}

/** " · Faculdade Aurora", quando a ação é de uma empresa. */
function daEmpresa(ev: EventoDeAtividade): Parte[] {
  return ev.empresa === null ? [] : [fraco(` · ${ev.empresa}`)];
}

/**
 * Rótulos dos campos que uma edição pode mudar — as chaves que `edicao.ts`
 * grava em `before`/`after`. Chave desconhecida é humanizada, não escondida.
 */
const CAMPOS: Record<string, string> = {
  nome: "nome",
  email: "e-mail",
  fuso: "fuso",
  headline: "chamada",
  bio: "apresentação",
  areas: "áreas",
  habilidades: "habilidades",
  senioridade: "senioridade",
  engajamento: "vínculo",
  maxPorSemana: "teto semanal",
  bufferMin: "descanso",
  confirmaSozinho: "confirmação automática",
  cargo: "cargo",
  area: "área",
};

export function rotuloDoCampo(chave: string): string {
  return CAMPOS[chave] ?? humanizar(chave).toLowerCase();
}

/** " — chamada, áreas", a partir das chaves que o `after` carrega. */
function camposAlterados(ev: EventoDeAtividade): Parte[] {
  if (typeof ev.depois !== "object" || ev.depois === null) return [];
  const chaves = Object.keys(ev.depois);
  if (chaves.length === 0) return [];
  return [fraco(` — ${chaves.map(rotuloDoCampo).join(", ")}`)];
}

function statusNovo(ev: EventoDeAtividade): string | null {
  return textoDe(ev.depois, "status");
}

export const ACOES = {
  criar_empresa: {
    icone: () => "building",
    tom: () => "accent",
    predicado: (ev, t) => [
      fraco(`criou a ${t.org.toLowerCase()} `),
      forte(ev.empresa ?? textoDe(ev.depois, "nome") ?? t.org.toLowerCase()),
    ],
  },
  registrar_compra: {
    icone: () => "contract",
    tom: () => "gold",
    predicado: (ev, t) => {
      const fichas = numero(ev.depois, "fichas");
      return [
        fraco("registrou "),
        forte(fichas === null ? t.fichas : countFichas(fichas, t)),
        fraco(" no contrato de "),
        forte(ev.empresa ?? t.org.toLowerCase()),
      ];
    },
  },
  alocar_fichas: {
    icone: () => "coins",
    tom: () => "gold",
    predicado: (ev, t) => {
      const quantidade = numero(ev.depois, "quantidade");
      return [
        fraco("alocou "),
        forte(quantidade === null ? t.fichas : countFichas(quantidade, t)),
        fraco(" para "),
        forte(nomeDoAlvo(ev)),
        ...daEmpresa(ev),
      ];
    },
  },
  criar_profissional: {
    icone: () => "user-plus",
    tom: () => "accent",
    predicado: (ev, t) => [
      fraco(`criou o ${t.professional} `),
      forte(nomeDoAlvo(ev)),
      ...daEmpresa(ev),
    ],
  },
  criar_parceiro: {
    icone: () => "user-plus",
    tom: () => "accent",
    predicado: (ev, t) => [fraco(`criou o ${t.partner} `), forte(nomeDoAlvo(ev))],
  },
  editar_parceiro: {
    icone: () => "pencil",
    tom: () => "neutral",
    predicado: (ev, t) => [
      fraco(`editou o ${t.partner} `),
      forte(nomeDoAlvo(ev)),
      ...camposAlterados(ev),
    ],
  },
  alterar_status_parceiro: {
    icone: (ev) => {
      const status = statusNovo(ev);
      if (status === "paused") return "pause";
      if (status === "archived") return "archive";
      return "reactivate";
    },
    tom: (ev) => (statusNovo(ev) === "archived" ? "bad" : "neutral"),
    predicado: (ev, t) => {
      const status = statusNovo(ev);
      const verbo =
        status === "paused"
          ? "pausou"
          : status === "archived"
            ? "arquivou"
            : status === "active"
              ? "reativou"
              : "mudou o status do";
      return [fraco(`${verbo} o ${t.partner} `), forte(nomeDoAlvo(ev))];
    },
  },
  editar_profissional: {
    icone: () => "pencil",
    tom: () => "neutral",
    predicado: (ev, t) => [
      fraco(`editou o ${t.professional} `),
      forte(nomeDoAlvo(ev)),
      ...camposAlterados(ev),
    ],
  },
  desativar_conta: {
    icone: () => "user-x",
    tom: () => "bad",
    predicado: (ev) => [fraco("desativou o acesso de "), forte(nomeDoAlvo(ev)), ...daEmpresa(ev)],
  },
  reativar_conta: {
    icone: () => "reactivate",
    tom: () => "neutral",
    predicado: (ev) => [fraco("reativou o acesso de "), forte(nomeDoAlvo(ev)), ...daEmpresa(ev)],
  },
  redefinir_senha: {
    icone: () => "key",
    tom: () => "neutral",
    predicado: (ev) => [fraco("gerou uma nova senha provisória para "), forte(nomeDoAlvo(ev))],
  },
} as const satisfies Record<string, Definicao>;

export type AcaoAuditada = keyof typeof ACOES;

export const ACOES_AUDITADAS = Object.keys(ACOES) as AcaoAuditada[];

export function ehAcaoConhecida(acao: string): acao is AcaoAuditada {
  return Object.hasOwn(ACOES, acao);
}

export type Descricao = { icone: NomeIcone; tom: Tom; partes: Parte[] };

/**
 * A frase inteira: "**João Paulo Ferreira** alocou **2 fichas** para
 * **Mariana Costa** · Faculdade Aurora".
 *
 * Código que o catálogo não conhece — histórico gravado antes de uma ação ser
 * renomeada, por exemplo — sai humanizado em vez de cru.
 */
export function descrever(ev: EventoDeAtividade, t: Terms): Descricao {
  const sujeito = forte(ev.autor ?? "Trabalho agendado");

  if (!ehAcaoConhecida(ev.acao)) {
    return {
      icone: "history",
      tom: "neutral",
      partes: [sujeito, fraco(` — ${humanizar(ev.acao).toLowerCase()}`)],
    };
  }

  const definicao: Definicao = ACOES[ev.acao];
  return {
    icone: definicao.icone(ev),
    tom: definicao.tom(ev),
    partes: [sujeito, fraco(" "), ...definicao.predicado(ev, t)],
  };
}

/** Rótulo curto para filtro por tipo: "Alocar fichas", com o termo da empresa. */
export function rotuloDaAcao(acao: AcaoAuditada, t: Terms): string {
  const ROTULOS: Record<AcaoAuditada, string> = {
    criar_empresa: `Criar ${t.org.toLowerCase()}`,
    registrar_compra: "Registrar contrato",
    alocar_fichas: `Alocar ${t.fichas}`,
    criar_profissional: `Criar ${t.professional}`,
    criar_parceiro: `Criar ${t.partner}`,
    editar_parceiro: `Editar ${t.partner}`,
    alterar_status_parceiro: `Status de ${t.partner}`,
    editar_profissional: `Editar ${t.professional}`,
    desativar_conta: "Desativar acesso",
    reativar_conta: "Reativar acesso",
    redefinir_senha: "Nova senha",
  };
  return cap(ROTULOS[acao]);
}
