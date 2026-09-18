/**
 * Quem pode abrir o quê. Tabela única, consultada pelo `proxy.ts` antes de a
 * página existir e pelos layouts depois — as duas pontas leem a mesma regra,
 * então não há como uma autorizar e a outra negar.
 *
 * Isto é conveniência de interface, não segurança. Quem protege o dado é a
 * RLS: mesmo que uma rota vazasse, a consulta volta vazia. O papel daqui é
 * não mostrar a casca errada e não deixar ninguém encarar um 403 do banco.
 *
 * Módulo puro — o `proxy.ts` importa e nada de `next/*` entra junto.
 */

import { type Role } from "./claims";

/** Para onde cada papel vai ao entrar, e quando pede uma rota que não é dele. */
export const HOME_BY_ROLE: Record<Role, string> = {
  professional: "/inicio",
  partner: "/parceiro/inicio",
  org_admin: "/empresa/painel",
  admin: "/admin/painel",
  moderator: "/admin/painel",
};

export type RouteRule = { prefix: string; roles: readonly Role[] };

/**
 * Prefixo → papéis. O `moderator` usa as rotas do `admin` porque usa a mesma
 * casca; o que ele não pode fazer é recortado dentro de cada tela, não aqui.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: "/inicio", roles: ["professional"] },
  { prefix: "/parceiros", roles: ["professional"] },
  { prefix: "/agenda", roles: ["professional"] },
  { prefix: "/fichas", roles: ["professional"] },
  { prefix: "/parceiro", roles: ["partner"] },
  { prefix: "/empresa", roles: ["org_admin"] },
  { prefix: "/admin", roles: ["admin", "moderator"] },
];

/** Rotas de quem ainda não entrou. */
export const PUBLIC_PREFIXES: readonly string[] = ["/entrar"];

/**
 * Prefixo por **segmento**, nunca por string.
 *
 * `/parceiros` (busca do Profissional) e `/parceiro` (casca do Parceiro) são
 * rotas de papéis diferentes e uma é prefixo textual da outra. Com
 * `startsWith` puro o Profissional cairia na casca do Parceiro.
 */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * Papéis que podem abrir a rota, ou null quando ela não é de papel nenhum —
 * `/` e `/design`, que se resolvem sozinhas.
 */
export function rolesFor(pathname: string): readonly Role[] | null {
  const rule = ROUTE_RULES.find((candidate) => matchesPrefix(pathname, candidate.prefix));
  return rule ? rule.roles : null;
}

export function canAccess(role: Role, pathname: string): boolean {
  const allowed = rolesFor(pathname);
  return allowed === null || allowed.includes(role);
}

/**
 * Destino de `?next=`, se for seguro. Vale só caminho interno que o papel
 * pode abrir — `//host` e `https://host` são redirecionamento aberto, e
 * mandar alguém para a rota de outro papel só produziria um segundo desvio.
 */
export function safeNext(next: string | null | undefined, role: Role): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  const pathname = next.split(/[?#]/)[0];
  if (isPublicPath(pathname)) return null;
  return canAccess(role, pathname) ? next : null;
}
