import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "./claims";
import { canAccess, HOME_BY_ROLE, isPublicPath, matchesPrefix, rolesFor, safeNext } from "./routes";
import { DEFAULT_TERMS } from "@/lib/terms";
import { navFor, SHELL_BY_ROLE, type Shell } from "@/lib/roles";

describe("prefixo por segmento", () => {
  /**
   * `/parceiros` é a busca do Profissional e `/parceiro` é a casca do
   * Parceiro. Uma é prefixo textual da outra, então `startsWith` puro mandaria
   * todo Profissional para a casca errada — e como as duas telas existem, o
   * erro não apareceria como 404, apareceria como papel trocado.
   */
  it("não confunde /parceiros com /parceiro", () => {
    expect(matchesPrefix("/parceiros", "/parceiro")).toBe(false);
    expect(rolesFor("/parceiros")).toEqual(["professional"]);
    expect(rolesFor("/parceiro/inicio")).toEqual(["partner"]);
    expect(canAccess("professional", "/parceiros")).toBe(true);
    expect(canAccess("professional", "/parceiro/inicio")).toBe(false);
    expect(canAccess("partner", "/parceiros")).toBe(false);
  });

  it("casa o próprio caminho e o que desce dele", () => {
    expect(matchesPrefix("/admin", "/admin")).toBe(true);
    expect(matchesPrefix("/admin/painel", "/admin")).toBe(true);
    expect(matchesPrefix("/administracao", "/admin")).toBe(false);
  });
});

describe("acesso por papel", () => {
  it("cada papel entra na própria casa", () => {
    for (const role of ROLES) {
      expect(canAccess(role, HOME_BY_ROLE[role])).toBe(true);
    }
  });

  it("moderador acompanha o admin, e só ele", () => {
    expect(canAccess("moderator", "/admin/fila")).toBe(true);
    expect(canAccess("moderator", "/empresa/painel")).toBe(false);
    expect(canAccess("moderator", "/inicio")).toBe(false);
  });

  it("RH não alcança rota de sessão — invariante 10 começa na rota", () => {
    expect(canAccess("org_admin", "/agenda")).toBe(false);
    expect(canAccess("org_admin", "/parceiro/sessoes")).toBe(false);
  });

  it("rota sem dono é de todos — `/design` não é de papel nenhum", () => {
    expect(rolesFor("/design")).toBeNull();
    expect(canAccess("professional", "/design")).toBe(true);
  });

  it("/entrar é pública e nenhuma casca é", () => {
    expect(isPublicPath("/entrar")).toBe(true);
    for (const role of ROLES) {
      expect(isPublicPath(HOME_BY_ROLE[role])).toBe(false);
    }
  });
});

/**
 * A navegação e a tabela de acesso são escritas em arquivos diferentes e têm
 * tudo para divergir. Este teste amarra as duas: um item de menu que o papel
 * não pode abrir é um link para um redirecionamento.
 */
describe("navegação e acesso não divergem", () => {
  const SHELLS: Shell[] = ["professional", "partner", "org", "admin"];

  it.each(SHELLS)("todo item da casca %s é acessível a quem a usa", (shell) => {
    const donos = ROLES.filter((role) => SHELL_BY_ROLE[role] === shell);
    expect(donos.length).toBeGreaterThan(0);

    for (const item of navFor(shell, DEFAULT_TERMS)) {
      for (const role of ROLES) {
        expect(canAccess(role, item.href)).toBe(donos.includes(role));
      }
    }
  });
});

describe("safeNext", () => {
  const pro: Role = "professional";

  it("aceita caminho interno que o papel abre", () => {
    expect(safeNext("/agenda", pro)).toBe("/agenda");
    expect(safeNext("/agenda?dia=hoje", pro)).toBe("/agenda?dia=hoje");
  });

  it("recusa destino externo", () => {
    expect(safeNext("//evil.example", pro)).toBeNull();
    expect(safeNext("https://evil.example", pro)).toBeNull();
    expect(safeNext("evil.example", pro)).toBeNull();
  });

  it("recusa rota de outro papel — só produziria um segundo desvio", () => {
    expect(safeNext("/admin/painel", pro)).toBeNull();
    expect(safeNext("/parceiro/inicio", pro)).toBeNull();
  });

  it("recusa voltar para a própria entrada", () => {
    expect(safeNext("/entrar", pro)).toBeNull();
  });

  it("vazio é ausência de destino", () => {
    expect(safeNext(null, pro)).toBeNull();
    expect(safeNext("", pro)).toBeNull();
  });
});
