import { describe, expect, it } from "vitest";
import { ORG_SCOPED_ROLES, parseClaims, ROLES } from "./claims";

/**
 * Invariante 19 do lado da aplicação: o que vale é o que está no JWT, e o que
 * está no JWT é validado antes de virar sessão.
 */

const USER = "11111111-1111-1111-1111-111111111111";
const ORG = "22222222-2222-2222-2222-222222222222";

function claims(extra: Record<string, unknown>) {
  return { sub: USER, email: "pessoa@empresa.com.br", ...extra };
}

describe("parseClaims", () => {
  it("aceita Profissional com empresa", () => {
    expect(parseClaims(claims({ user_role: "professional", org_id: ORG }))).toEqual({
      userId: USER,
      role: "professional",
      orgId: ORG,
      email: "pessoa@empresa.com.br",
    });
  });

  it("aceita Parceiro sem empresa — ele é da plataforma", () => {
    const session = parseClaims(claims({ user_role: "partner" }));
    expect(session?.role).toBe("partner");
    expect(session?.orgId).toBeNull();
  });

  it("nega quando falta `user_role` — é como o hook trata quem está inativo", () => {
    expect(parseClaims(claims({ org_id: ORG }))).toBeNull();
  });

  it("nega papel que não existe no enum", () => {
    expect(parseClaims(claims({ user_role: "root" }))).toBeNull();
    expect(parseClaims(claims({ user_role: "" }))).toBeNull();
    expect(parseClaims(claims({ user_role: 1 }))).toBeNull();
  });

  it("nega `sub` ausente ou que não é uuid", () => {
    expect(parseClaims({ user_role: "admin" })).toBeNull();
    expect(parseClaims({ sub: "eu", user_role: "admin" })).toBeNull();
  });

  it("nega o que não é objeto", () => {
    for (const value of [null, undefined, "", 0, [], "claims"]) {
      expect(parseClaims(value)).toBeNull();
    }
  });

  /**
   * Invariante 9 conferida no token. O `check` de `profiles` impede a linha
   * que geraria um token assim — então chegar aqui significa token forjado ou
   * esquema burlado, e nos dois casos a resposta é não.
   */
  describe("invariante 9 — escopo de empresa combina com o papel", () => {
    it.each(ROLES)("%s coerente entra, incoerente não", (role) => {
      const daEmpresa = ORG_SCOPED_ROLES.includes(role);
      const comOrg = parseClaims(claims({ user_role: role, org_id: ORG }));
      const semOrg = parseClaims(claims({ user_role: role }));

      expect(comOrg === null).toBe(!daEmpresa);
      expect(semOrg === null).toBe(daEmpresa);
    });

    it("nega `org_id` que não é uuid", () => {
      expect(parseClaims(claims({ user_role: "professional", org_id: "empresa-1" }))).toBeNull();
    });
  });

  it("e-mail ausente não impede a sessão — identidade é o `sub`", () => {
    const session = parseClaims({ sub: USER, user_role: "admin" });
    expect(session?.email).toBeNull();
  });
});
