import type { NomeIcone } from "@/components/ui/icones";
import { type Role } from "@/lib/auth/claims";
import { cap, type Terms } from "@/lib/terms";

export type { Role };
export { HOME_BY_ROLE } from "@/lib/auth/routes";

/** Casca visual. O `moderator` usa a casca do `admin` — é delegado dela. */
export type Shell = "professional" | "partner" | "org" | "admin";

/**
 * O ícone vai por nome, não por componente: esta lista é montada na `Sidebar`
 * (servidor) e entregue a `NavLinks` (cliente), e só dado serializável
 * atravessa essa fronteira.
 */
export type NavItem = { href: string; label: string; icone: NomeIcone };

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
        { href: "/inicio", label: "Início", icone: "home" },
        { href: "/parceiros", label: t.partners, icone: "handshake" },
        { href: "/agenda", label: "Minha agenda", icone: "calendar" },
        { href: "/fichas", label: `Minhas ${t.fichas}`, icone: "coins" },
      ];
    case "partner":
      return [
        { href: "/parceiro/inicio", label: "Início", icone: "home" },
        { href: "/parceiro/sessoes", label: cap(t.sessions), icone: "calendar" },
        { href: "/parceiro/disponibilidade", label: "Disponibilidade", icone: "calendar-clock" },
        { href: "/parceiro/perfil", label: "Meu perfil", icone: "user" },
      ];
    case "org":
      return [
        { href: "/empresa/painel", label: "Painel", icone: "dashboard" },
        { href: "/empresa/colaboradores", label: "Colaboradores", icone: "users" },
        { href: "/empresa/fichas", label: `${cap(t.fichas)} do contrato`, icone: "coins" },
      ];
    case "admin":
      return [
        { href: "/admin/painel", label: "Painel", icone: "dashboard" },
        { href: "/admin/empresas", label: t.orgs, icone: "building" },
        { href: "/admin/parceiros", label: t.partners, icone: "handshake" },
        { href: "/admin/atividade", label: "Atividade", icone: "history" },
        { href: "/admin/fila", label: "Fila de decisões", icone: "inbox" },
        { href: "/admin/personalizacao", label: "Personalização", icone: "palette" },
      ];
  }
}
