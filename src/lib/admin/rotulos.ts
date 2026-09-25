import type { PillVariant } from "@/components/ui/Pill";
import { humanizar } from "@/lib/humanizar";

/**
 * Enums do banco como a tela os mostra. Mapa e não `switch` porque o valor vem
 * do banco como texto: um status novo no enum aparece humanizado em vez de
 * derrubar a página — e nunca com sublinhado (`pending_review`).
 */

const STATUS: Record<string, { rotulo: string; cor: PillVariant }> = {
  invited: { rotulo: "Convidado", cor: "off" },
  onboarding: { rotulo: "Em cadastro", cor: "neutral" },
  pending_review: { rotulo: "Em revisão", cor: "wait" },
  active: { rotulo: "Ativo", cor: "on" },
  paused: { rotulo: "Pausado", cor: "wait" },
  archived: { rotulo: "Arquivado", cor: "off" },
};

export function rotuloDoStatus(status: string): string {
  return STATUS[status]?.rotulo ?? humanizar(status);
}

export function corDoStatus(status: string): PillVariant {
  return STATUS[status]?.cor ?? "neutral";
}

/** O que cada status significa para quem lê o card — a consequência, não o nome. */
export function explicacaoDoStatus(status: string): string {
  switch (status) {
    case "active":
      return "Aparece na busca de todas as empresas e entra normalmente.";
    case "paused":
      return "Fora da busca. Continua entrando, e as sessões já marcadas seguem de pé.";
    case "archived":
      return "Fora da busca e sem acesso. O histórico fica.";
    default:
      return "Estado de convite — ainda não opera no piloto.";
  }
}

const VINCULOS: Record<string, string> = {
  voluntario: "voluntário",
  parceria: "parceria",
  remunerado: "remunerado",
};

export function rotuloDoVinculo(valor: string): string {
  return VINCULOS[valor] ?? humanizar(valor).toLowerCase();
}
