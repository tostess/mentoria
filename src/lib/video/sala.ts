import { segundos, type PropriedadesSala, type PropriedadesToken } from "./daily";

/**
 * As regras da sala, puras: quando abre, quando fecha, o que o Daily recebe.
 *
 * A sala é o `booking_id` — UUID é nome válido no Daily (letras, dígitos e `-`)
 * e cabe nos 36 caracteres de `user_id`. Nome derivado, e não sorteado, é o que
 * deixa o fechamento perguntar ao Daily pela sala certa sem depender de nada
 * que a entrada tenha gravado.
 */

/** A porta abre dez minutos antes do horário, para testar câmera sem pressa. */
export const ABRE_ANTES_MIN = 10;

/**
 * A chamada termina cinco minutos depois do fim marcado.
 *
 * Constante, e não `app_config`, porque o número está amarrado ao Daily: o
 * Prebuilt mostra o aviso "a reunião terminará em" nos últimos 5 minutos antes do
 * `exp` da sala (medido no spike). Com tolerância de 5, o aviso aparece
 * exatamente no fim marcado. Mudar o número desencontraria o aviso do horário da
 * sessão — é decisão de produto, não ajuste de operação.
 */
export const FECHA_DEPOIS_MIN = 5;

const MINUTO = 60_000;

export type Janela = { abre: Date; fecha: Date };

export function janelaDaSala(inicio: Date, fim: Date): Janela {
  return {
    abre: new Date(inicio.getTime() - ABRE_ANTES_MIN * MINUTO),
    fecha: new Date(fim.getTime() + FECHA_DEPOIS_MIN * MINUTO),
  };
}

export type SessaoParaSala = { status: string; inicio: Date; fim: Date };

export type Porta =
  | { aberta: true; janela: Janela }
  | { aberta: false; janela: Janela; motivo: "cedo" | "encerrada" | "nao-confirmada" };

/**
 * A pessoa pode receber token agora?
 *
 * `nbf` e `exp` do token e da sala repetem a mesma janela — são a segunda cerca,
 * para o dia em que alguém emitir token por outro caminho. A primeira é esta,
 * no servidor, porque a tela de recusa do Daily ("esta chamada ainda não está
 * disponível") não diz a hora em que abre.
 */
export function porta(sessao: SessaoParaSala, agora: Date): Porta {
  const janela = janelaDaSala(sessao.inicio, sessao.fim);
  if (sessao.status !== "confirmed") return { aberta: false, janela, motivo: "nao-confirmada" };
  if (agora.getTime() < janela.abre.getTime()) return { aberta: false, janela, motivo: "cedo" };
  if (agora.getTime() >= janela.fecha.getTime()) return { aberta: false, janela, motivo: "encerrada" };
  return { aberta: true, janela };
}

/**
 * A sala encerra a chamada sozinha em `fim` + 5: `eject_at_room_exp`. Não há
 * cron de encerramento — a hora do fim é conhecida quando a sala nasce, porque a
 * sessão não se estende (decisão de 27/09/2026).
 *
 * `geo` fixa a mídia em São Paulo em qualquer domínio, sem depender da
 * configuração do painel do Daily: sem ele, o servidor da chamada é o mais perto
 * de quem entrar primeiro.
 */
export function propriedadesDaSala(inicio: Date, fim: Date): PropriedadesSala {
  const { abre, fecha } = janelaDaSala(inicio, fim);
  return {
    nbf: segundos(abre),
    exp: segundos(fecha),
    eject_at_room_exp: true,
    max_participants: 2,
    enable_prejoin_ui: true,
    lang: "pt-BR",
    geo: "sa-east-1",
  };
}

/**
 * Só o primeiro nome vai para o Daily, que guarda metadados de reunião nos EUA
 * (LGPD, art. 33). É o que o outro lado vê na chamada, e é o bastante.
 */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

export type Participante = {
  userId: string;
  nome: string;
  /** O Parceiro é dono da sala: pode silenciar e remover. */
  ehParceiro: boolean;
};

/**
 * Token de uma entrada. Emitido a cada entrada, nunca reaproveitado: o Prebuilt
 * apaga o `?t=` da URL depois de ler, e recarregar a página é entrar sem token.
 *
 * `user_id` = `profiles.id`. É por ele que o fechamento reconhece quem entrou.
 *
 * `retorno` é a tela de fim nossa, em endereço absoluto: quem clica em sair no
 * Prebuilt é levado para lá dentro do iframe, e a página sobe para a janela de
 * cima. Sem ele o iframe ficaria na tela do Daily.
 */
export function propriedadesDoToken(
  bookingId: string,
  inicio: Date,
  fim: Date,
  quem: Participante,
  retorno?: string,
): PropriedadesToken {
  const { abre, fecha } = janelaDaSala(inicio, fim);
  return {
    room_name: bookingId,
    user_id: quem.userId,
    user_name: primeiroNome(quem.nome),
    is_owner: quem.ehParceiro,
    nbf: segundos(abre),
    exp: segundos(fecha),
    lang: "pt-BR",
    ...(retorno === undefined ? {} : { redirect_on_meeting_exit: retorno }),
  };
}

/** A tela de fim da sessão, relativa. A rota de entrada a torna absoluta. */
export function caminhoDoFim(bookingId: string): string {
  return `/sala/${bookingId}/fim`;
}
