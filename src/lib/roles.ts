import { cap, terms } from "@/lib/terms";

export type Role = "admin" | "moderator" | "org_admin" | "partner" | "professional";

/** Casca visual: moderator usa a casca do admin. */
export type Shell = "professional" | "partner" | "org" | "admin";

export type NavItem = { href: string; label: string };

export const HOME_BY_ROLE: Record<Role, string> = {
  professional: "/inicio",
  partner: "/parceiro/inicio",
  org_admin: "/empresa/painel",
  admin: "/admin/painel",
  moderator: "/admin/painel",
};

export const SHELL_BY_ROLE: Record<Role, Shell> = {
  professional: "professional",
  partner: "partner",
  org_admin: "org",
  admin: "admin",
  moderator: "admin",
};

export const SHELL_LABEL: Record<Shell, string> = {
  professional: terms.professional,
  partner: terms.partner,
  org: terms.orgAdmin,
  admin: terms.admin,
};

export const SHELL_HOME: Record<Shell, string> = {
  professional: "/inicio",
  partner: "/parceiro/inicio",
  org: "/empresa/painel",
  admin: "/admin/painel",
};

export const NAV_BY_SHELL: Record<Shell, NavItem[]> = {
  professional: [
    { href: "/inicio", label: "Início" },
    { href: "/parceiros", label: terms.partners },
    { href: "/agenda", label: "Minha agenda" },
    { href: "/fichas", label: `Minhas ${terms.fichas}` },
  ],
  partner: [
    { href: "/parceiro/inicio", label: "Início" },
    { href: "/parceiro/sessoes", label: cap(terms.sessions) },
    { href: "/parceiro/disponibilidade", label: "Disponibilidade" },
    { href: "/parceiro/perfil", label: "Meu perfil" },
  ],
  org: [
    { href: "/empresa/painel", label: "Painel" },
    { href: "/empresa/colaboradores", label: "Colaboradores" },
    { href: "/empresa/fichas", label: `${cap(terms.fichas)} do contrato` },
  ],
  admin: [
    { href: "/admin/painel", label: "Painel" },
    { href: "/admin/empresas", label: terms.orgs },
    { href: "/admin/parceiros", label: terms.partners },
    { href: "/admin/fila", label: "Fila de decisões" },
    { href: "/admin/personalizacao", label: "Personalização" },
  ],
};
