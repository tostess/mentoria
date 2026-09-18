import { type Role } from "@/lib/auth/claims";
import { cap, type Terms } from "@/lib/terms";

export type { Role };
export { HOME_BY_ROLE } from "@/lib/auth/routes";

/** Casca visual. O `moderator` usa a casca do `admin` — é delegado dela. */
export type Shell = "professional" | "partner" | "org" | "admin";

export type NavItem = { href: string; label: string };

export const SHELL_BY_ROLE: Record<Role, Shell> = {
  professional: "professional",
  partner: "partner",
  org_admin: "org",
  admin: "admin",
  moderator: "admin",
};

/**
 * Rótulo e navegação são funções dos termos, não constantes.
 *
 * Constante seria avaliada na importação, com o vocabulário default fixado no
 * bundle — e empresa que chama Parceiro de outra coisa veria "Parceiros" na
 * navegação e o termo dela no resto da tela.
 */
export function shellLabel(shell: Shell, t: Terms): string {
  switch (shell) {
    case "professional":
      return t.professional;
    case "partner":
      return t.partner;
    case "org":
      return t.orgAdmin;
    case "admin":
      return t.admin;
  }
}

export function navFor(shell: Shell, t: Terms): NavItem[] {
  switch (shell) {
    case "professional":
      return [
        { href: "/inicio", label: "Início" },
        { href: "/parceiros", label: t.partners },
        { href: "/agenda", label: "Minha agenda" },
        { href: "/fichas", label: `Minhas ${t.fichas}` },
      ];
    case "partner":
      return [
        { href: "/parceiro/inicio", label: "Início" },
        { href: "/parceiro/sessoes", label: cap(t.sessions) },
        { href: "/parceiro/disponibilidade", label: "Disponibilidade" },
        { href: "/parceiro/perfil", label: "Meu perfil" },
      ];
    case "org":
      return [
        { href: "/empresa/painel", label: "Painel" },
        { href: "/empresa/colaboradores", label: "Colaboradores" },
        { href: "/empresa/fichas", label: `${cap(t.fichas)} do contrato` },
      ];
    case "admin":
      return [
        { href: "/admin/painel", label: "Painel" },
        { href: "/admin/empresas", label: t.orgs },
        { href: "/admin/parceiros", label: t.partners },
        { href: "/admin/fila", label: "Fila de decisões" },
        { href: "/admin/personalizacao", label: "Personalização" },
      ];
  }
}
