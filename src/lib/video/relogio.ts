/**
 * O relógio da sala, puro: em que fase a sessão está e quantos segundos faltam.
 *
 * É ele que decide quando a página troca o vídeo pela tela de fim — no mesmo
 * segundo em que o Daily expulsa pela expiração da sala —, então vive aqui, com
 * teste, e não escondido num componente.
 */

/** Os últimos minutos antes do fim, quando o relógio fica dourado. */
export const RETA_FINAL_MIN = 5;

export type FaseDoRelogio = "antes" | "sessao" | "reta-final" | "tolerancia" | "fechada";

export type Relogio = {
  fase: FaseDoRelogio;
  /** Até o próximo marco: o início, o fim ou o fechamento da sala. */
  segundos: number;
};

export function relogio(agora: number, inicio: number, fim: number, fecha: number): Relogio {
  const ate = (marco: number) => Math.max(0, Math.ceil((marco - agora) / 1000));
  if (agora < inicio) return { fase: "antes", segundos: ate(inicio) };
  if (agora < fim) {
    return { fase: fim - agora > RETA_FINAL_MIN * 60_000 ? "sessao" : "reta-final", segundos: ate(fim) };
  }
  if (agora < fecha) return { fase: "tolerancia", segundos: ate(fecha) };
  return { fase: "fechada", segundos: 0 };
}

/** `18:42`, ou `1:05:09` acima de uma hora. */
export function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const segundos = String(s % 60).padStart(2, "0");
  return horas > 0 ? `${horas}:${String(minutos).padStart(2, "0")}:${segundos}` : `${minutos}:${segundos}`;
}
