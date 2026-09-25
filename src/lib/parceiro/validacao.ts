import { IANAZone } from "luxon";
import { CampoInvalido, texto, textoOpcional } from "@/lib/forms";
import { SENIORIDADES } from "./senioridades";

/**
 * Validação do perfil do Parceiro, compartilhada entre as duas portas que o
 * escrevem: o próprio Parceiro em `/parceiro/perfil` (pela RLS) e a operadora
 * em `/admin/parceiros/[id]` (fora dela). Duas regras de fuso divergindo é
 * como um Parceiro salva um valor que o outro lado recusa.
 */

export { SENIORIDADES } from "./senioridades";

export function fuso(form: FormData): string {
  const valor = texto(form, "fuso", "o fuso horário", 64);
  if (!IANAZone.isValidZone(valor)) {
    throw new CampoInvalido("Fuso horário desconhecido. Use algo como America/Sao_Paulo.");
  }
  return valor;
}

export function senioridade(form: FormData): string | null {
  const valor = textoOpcional(form, "senioridade", 40);
  if (valor !== null && !SENIORIDADES.some((s) => s.valor === valor)) {
    throw new CampoInvalido("Senioridade inválida.");
  }
  return valor;
}
