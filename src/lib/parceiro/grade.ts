/**
 * A grade semanal e as folgas do Parceiro, entre o formulário e o banco.
 *
 * Módulo puro: recebe o que o formulário mandou e devolve linhas prontas para
 * `partner_rules` e `partner_exceptions`, ou recusa com a frase que a tela
 * mostra. Quem calcula horário continua sendo o motor (invariante 14) — aqui só
 * se decide o que é uma rotina válida de se guardar.
 *
 * Os erros são `CampoInvalido` porque Server Action só transforma esse tipo em
 * mensagem; qualquer outro vira 500, e "horário inválido" não é falha de
 * servidor.
 */

import { CampoInvalido } from "@/lib/forms";
// Direto de `dias`, não do índice: o índice traz `slots`, e com ele o luxon, que
// não deve ir para o bundle do cliente que importa as constantes daqui.
import { diaDaSemanaDe, diasEntre, ehDataValida } from "@/lib/scheduling/dias";
import type { DiaDaSemana } from "@/lib/scheduling";
import { DIAS, HorarioInvalido, ehDiaDaSemana, paraMinutos, paraTexto } from "./horarios";

/** Uma faixa da grade: "terça, das 9h às 12h". Minutos no fuso do Parceiro. */
export type FaixaDaGrade = { dia: DiaDaSemana; inicioMin: number; fimMin: number };

/** Faixas por dia. Seis cobre manhã, almoço e noite com folga; mais que isso é erro de clique. */
export const MAX_FAIXAS_POR_DIA = 6;

/** Férias de três meses cabem; uma linha por dia, então o teto protege a tabela. */
export const MAX_DIAS_DE_FOLGA = 92;

function minutos(texto: unknown, rotulo: string): number {
  if (typeof texto !== "string") throw new CampoInvalido(`Preencha ${rotulo}.`);
  try {
    return paraMinutos(texto);
  } catch (erro) {
    if (erro instanceof HorarioInvalido) throw new CampoInvalido(erro.message);
    throw erro;
  }
}

/**
 * Lê a grade que o cliente serializou: `[{ dia, inicio: "09:00", fim: "12:00" }]`.
 *
 * O formato é do nosso componente, mas o POST pode ser forjado — cada campo é
 * conferido antes de virar número.
 */
export function lerGrade(json: string): FaixaDaGrade[] {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new CampoInvalido("Não deu para ler a grade. Recarregue a página e tente de novo.");
  }
  if (!Array.isArray(bruto)) {
    throw new CampoInvalido("Não deu para ler a grade. Recarregue a página e tente de novo.");
  }

  return bruto.map((item: unknown) => {
    if (item === null || typeof item !== "object") {
      throw new CampoInvalido("Não deu para ler a grade. Recarregue a página e tente de novo.");
    }
    const { dia, inicio, fim } = item as Record<string, unknown>;
    if (!ehDiaDaSemana(dia)) throw new CampoInvalido("Dia da semana inválido.");
    return {
      dia,
      inicioMin: minutos(inicio, "o horário de início"),
      fimMin: minutos(fim, "o horário de término"),
    };
  });
}

/**
 * A grade que pode ser guardada, ordenada por dia e hora.
 *
 * Recusa faixa ao contrário, faixa menor que uma sessão e faixas do mesmo dia
 * que se sobrepõem. O motor uniria as sobrepostas sem reclamar, mas aí a tela
 * mostraria duas linhas onde o banco tem uma intenção só — e o Parceiro que
 * digitou 9–12 e 11–13 provavelmente errou um dos dois. Faixas encostadas
 * (9–12 e 12–14) passam: é uma pausa de zero minutos, não um erro.
 *
 * Grade vazia é válida: é o Parceiro dizendo que não atende em semana nenhuma.
 */
export function validarGrade(faixas: readonly FaixaDaGrade[], duracaoMin: number): FaixaDaGrade[] {
  const ordenadas = [...faixas].sort((a, b) => a.dia - b.dia || a.inicioMin - b.inicioMin);

  for (const faixa of ordenadas) {
    const nome = DIAS[faixa.dia].longo;
    if (faixa.fimMin <= faixa.inicioMin) {
      throw new CampoInvalido(
        `Na ${nome}, o término (${paraTexto(faixa.fimMin)}) precisa ser depois do início (${paraTexto(faixa.inicioMin)}).`,
      );
    }
    if (faixa.fimMin - faixa.inicioMin < duracaoMin) {
      throw new CampoInvalido(
        `Na ${nome}, a faixa das ${paraTexto(faixa.inicioMin)} precisa ter pelo menos ${duracaoMin} minutos — uma sessão inteira.`,
      );
    }
  }

  for (let i = 1; i < ordenadas.length; i += 1) {
    const antes = ordenadas[i - 1];
    const agora = ordenadas[i];
    if (antes.dia === agora.dia && agora.inicioMin < antes.fimMin) {
      throw new CampoInvalido(
        `Na ${DIAS[agora.dia].longo}, as faixas ${faixaEmTexto(antes)} e ${faixaEmTexto(agora)} se sobrepõem.`,
      );
    }
  }

  for (const { valor, longo } of DIAS) {
    if (ordenadas.filter((f) => f.dia === valor).length > MAX_FAIXAS_POR_DIA) {
      throw new CampoInvalido(`Na ${longo}, use no máximo ${MAX_FAIXAS_POR_DIA} faixas.`);
    }
  }

  return ordenadas;
}

function faixaEmTexto(faixa: { inicioMin: number; fimMin: number }): string {
  return `${paraTexto(faixa.inicioMin)}–${paraTexto(faixa.fimMin)}`;
}

// ---------------------------------------------------------------------------
// Folgas e horários extras
// ---------------------------------------------------------------------------

/**
 * O que o formulário de folga manda.
 *
 * `bloqueio` cobre um período (férias, congresso), o dia inteiro ou só uma
 * faixa; `extra` abre uma faixa num dia só. Extra sem faixa não existe — o
 * motor ignoraria, e o Parceiro acharia que abriu o dia.
 */
export type NovaFolga = {
  tipo: "bloqueio" | "extra";
  de: string;
  ate: string;
  inicioMin: number | null;
  fimMin: number | null;
};

/** Uma linha de `partner_exceptions`, pronta para o insert. */
export type LinhaDeFolga = {
  dia: string;
  tipo: "bloqueio" | "extra";
  inicioMin: number | null;
  fimMin: number | null;
};

/**
 * Do formulário para as linhas do banco — uma por dia, que é o que o esquema
 * guarda e o motor lê.
 *
 * `hoje` é a data local do Parceiro: folga no passado não muda agenda nenhuma e
 * só polui a lista.
 */
export function linhasDaFolga(nova: NovaFolga, hoje: string, duracaoMin: number): LinhaDeFolga[] {
  if (!ehDataValida(nova.de)) throw new CampoInvalido("Escolha a data de início.");
  const ate = nova.tipo === "extra" ? nova.de : nova.ate;
  if (!ehDataValida(ate)) throw new CampoInvalido("Escolha a data de término.");
  if (nova.de < hoje) throw new CampoInvalido("A data já passou.");
  if (ate < nova.de) throw new CampoInvalido("O término precisa ser no mesmo dia do início ou depois.");

  const temFaixa = nova.inicioMin !== null && nova.fimMin !== null;
  if (nova.tipo === "extra" && !temFaixa) {
    throw new CampoInvalido("Diga das quantas às quantas o horário extra vai.");
  }
  if (temFaixa) {
    const inicio = nova.inicioMin as number;
    const fim = nova.fimMin as number;
    if (fim <= inicio) throw new CampoInvalido("O término precisa ser depois do início.");
    if (nova.tipo === "extra" && fim - inicio < duracaoMin) {
      throw new CampoInvalido(`O horário extra precisa ter pelo menos ${duracaoMin} minutos.`);
    }
  }

  const dias = diasEntre(nova.de, ate);
  if (dias.length > MAX_DIAS_DE_FOLGA) {
    throw new CampoInvalido(`Um período de no máximo ${MAX_DIAS_DE_FOLGA} dias por vez.`);
  }

  return dias.map((dia) => ({
    dia,
    tipo: nova.tipo,
    inicioMin: temFaixa ? nova.inicioMin : null,
    fimMin: temFaixa ? nova.fimMin : null,
  }));
}

/** O que a lista mostra: dias seguidos com a mesma folga viram uma linha só. */
export type GrupoDeFolga = {
  ids: string[];
  tipo: "bloqueio" | "extra";
  de: string;
  ate: string;
  inicioMin: number | null;
  fimMin: number | null;
};

function diaSeguinte(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Agrupa as linhas em períodos: "12/10 a 16/10, dia inteiro" em vez de cinco
 * linhas iguais. Junta dias seguidos (ou o mesmo dia repetido) com o mesmo tipo
 * e a mesma faixa; remover o grupo remove todas as linhas dele.
 */
export function agruparFolgas(
  linhas: readonly (LinhaDeFolga & { id: string })[],
): GrupoDeFolga[] {
  const ordenadas = [...linhas].sort(
    (a, b) =>
      a.tipo.localeCompare(b.tipo) ||
      (a.inicioMin ?? -1) - (b.inicioMin ?? -1) ||
      (a.fimMin ?? -1) - (b.fimMin ?? -1) ||
      a.dia.localeCompare(b.dia),
  );

  const grupos: GrupoDeFolga[] = [];
  for (const linha of ordenadas) {
    const ultimo = grupos[grupos.length - 1];
    const continua =
      ultimo !== undefined &&
      ultimo.tipo === linha.tipo &&
      ultimo.inicioMin === linha.inicioMin &&
      ultimo.fimMin === linha.fimMin &&
      (linha.dia === ultimo.ate || linha.dia === diaSeguinte(ultimo.ate));

    if (continua) {
      ultimo.ids.push(linha.id);
      ultimo.ate = linha.dia;
    } else {
      grupos.push({
        ids: [linha.id],
        tipo: linha.tipo,
        de: linha.dia,
        ate: linha.dia,
        inicioMin: linha.inicioMin,
        fimMin: linha.fimMin,
      });
    }
  }

  return grupos.sort((a, b) => a.de.localeCompare(b.de) || a.tipo.localeCompare(b.tipo));
}

/** Data e minuto de um instante no relógio de um fuso. */
export type MomentoLocal = { dia: string; minuto: number };

/**
 * O instante no relógio do Parceiro. Intl, sem luxon: roda no servidor, mas
 * não precisa de mais que isso para saber em que dia local caiu uma sessão.
 */
export function noRelogio(instante: Date, fuso: string): MomentoLocal {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return {
    dia: `${valor("year")}-${valor("month")}-${valor("day")}`,
    minuto: Number(valor("hour")) * 60 + Number(valor("minute")),
  };
}

/**
 * Quantas sessões marcadas caem dentro de um bloqueio.
 *
 * Bloquear não desmarca ninguém — cancelar mexe na ficha de outra pessoa e é
 * gesto explícito, pela agenda. A tela usa este número para avisar que a
 * folga fecha a agenda para pedidos novos, mas não para os que já existem.
 */
export function sessoesNoBloqueio(
  grupo: Pick<GrupoDeFolga, "tipo" | "de" | "ate" | "inicioMin" | "fimMin">,
  sessoes: readonly { inicio: MomentoLocal; fim: MomentoLocal }[],
): number {
  if (grupo.tipo !== "bloqueio") return 0;
  return sessoes.filter(({ inicio, fim }) => {
    if (inicio.dia < grupo.de || inicio.dia > grupo.ate) return false;
    if (grupo.inicioMin === null || grupo.fimMin === null) return true;
    // Sessão que atravessa a meia-noite termina no dia seguinte: conta até o fim do dia.
    const fimMin = fim.dia === inicio.dia ? fim.minuto : 1440;
    return inicio.minuto < grupo.fimMin && fimMin > grupo.inicioMin;
  }).length;
}

function dataCurta(iso: string): string {
  return `${DIAS[diaDaSemanaDe(iso)].curto} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * O período numa linha: "Seg 12/10 a Sex 16/10" e "dia inteiro" ou a faixa.
 * O ano fica de fora — a lista só mostra de hoje em diante, e folga marcada
 * para o ano que vem é rara o bastante para o dia da semana desambiguar.
 */
export function rotuloDaFolga(grupo: Pick<GrupoDeFolga, "de" | "ate" | "inicioMin" | "fimMin">): {
  periodo: string;
  faixa: string;
} {
  const periodo =
    grupo.de === grupo.ate ? dataCurta(grupo.de) : `${dataCurta(grupo.de)} a ${dataCurta(grupo.ate)}`;
  const faixa =
    grupo.inicioMin === null || grupo.fimMin === null
      ? "dia inteiro"
      : `${paraTexto(grupo.inicioMin)}–${paraTexto(grupo.fimMin)}`;
  return { periodo, faixa };
}
