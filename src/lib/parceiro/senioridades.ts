/**
 * As senioridades que o perfil do Parceiro aceita. Módulo à parte de
 * `validacao.ts` porque formulário de cliente precisa desta lista, e aquele
 * arquivo traz o `luxon` junto.
 */
export const SENIORIDADES = [
  { valor: "pleno", rotulo: "pleno" },
  { valor: "senior", rotulo: "sênior" },
  { valor: "especialista", rotulo: "especialista" },
  { valor: "executivo", rotulo: "executivo" },
] as const;
