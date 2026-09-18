import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { cap, countFichas, countSessions, DEFAULT_TERMS, resolveTerms } from "./terms";

/**
 * Contrato: nenhum termo de domínio é hardcoded, todos vivem em
 * `app_config.copy.terms` e são sobrescrevíveis por empresa.
 *
 * Até a Etapa 4 o vocabulário morava num objeto TypeScript exportado pronto —
 * tecnicamente "lido por `terms.ts`", na prática congelado no bundle. O que
 * segura a promessa não é o módulo existir, é ninguém conseguir pegar um
 * objeto de termos sem passar pela configuração resolvida.
 */

describe("resolveTerms", () => {
  it("sem sobrescrita, o default", () => {
    expect(resolveTerms(null)).toEqual(DEFAULT_TERMS);
    expect(resolveTerms(undefined)).toEqual(DEFAULT_TERMS);
    expect(resolveTerms({})).toEqual(DEFAULT_TERMS);
  });

  it("troca só o que veio", () => {
    const t = resolveTerms({ partner: "Mentor", partners: "Mentores" });
    expect(t.partner).toBe("Mentor");
    expect(t.partners).toBe("Mentores");
    expect(t.ficha).toBe(DEFAULT_TERMS.ficha);
  });

  it("apara espaço e ignora o que não é texto útil", () => {
    const t = resolveTerms({ partner: "  Mentor  ", professional: "", ficha: null, fichas: 3 });
    expect(t.partner).toBe("Mentor");
    expect(t.professional).toBe(DEFAULT_TERMS.professional);
    expect(t.ficha).toBe(DEFAULT_TERMS.ficha);
    expect(t.fichas).toBe(DEFAULT_TERMS.fichas);
  });

  it("chave desconhecida não entra", () => {
    const t = resolveTerms({ mentor: "Guru" });
    expect(t).toEqual(DEFAULT_TERMS);
    expect("mentor" in t).toBe(false);
  });

  it("o que não é objeto vira default", () => {
    for (const value of ["terms", 1, [], true]) {
      expect(resolveTerms(value)).toEqual(DEFAULT_TERMS);
    }
  });
});

describe("contagem usa sempre o termo configurado", () => {
  it("singular e plural", () => {
    expect(countFichas(1, DEFAULT_TERMS)).toBe("1 ficha");
    expect(countFichas(3, DEFAULT_TERMS)).toBe("3 fichas");
    expect(countSessions(1, DEFAULT_TERMS)).toBe("1 sessão");
    expect(countSessions(2, DEFAULT_TERMS)).toBe("2 sessões");
  });

  it("segue a empresa que renomeou a ficha", () => {
    const t = resolveTerms({ ficha: "crédito", fichas: "créditos" });
    expect(countFichas(1, t)).toBe("1 crédito");
    expect(countFichas(4, t)).toBe("4 créditos");
  });

  it("cap não estraga acento", () => {
    expect(cap("sessão")).toBe("Sessão");
    expect(cap("")).toBe("");
  });
});

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  id: relative(SRC, path).split(sep).join("/"),
  code: readFileSync(path, "utf8"),
}));

/**
 * `DEFAULT_TERMS` é o fallback de quando o banco não respondeu, não o
 * vocabulário do produto. Quem o importa para renderizar entrega o termo da
 * plataforma a uma empresa que pediu outro — e ninguém vê erro, só a palavra
 * errada na tela.
 */
const DEFAULT_TERMS_PERMITIDO = [
  "lib/terms.ts",
  "lib/terms.test.ts",
  "lib/config/app-config.ts", // monta o resolvido por cima do default
  "lib/config/app-config.test.ts",
  "lib/auth/routes.test.ts", // navegação é comparada com vocabulário fixo
  "components/config/TermsProvider.tsx", // valor do contexto fora de um provider
];

describe("o vocabulário vem da configuração, não do bundle", () => {
  it("encontrou o código-fonte", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("`terms.ts` não exporta um objeto de termos pronto para uso", () => {
    const terms = files.find((f) => f.id === "lib/terms.ts");
    expect(terms).toBeDefined();
    expect(terms!.code).not.toMatch(/^export const terms\b/m);
  });

  it("só quem monta ou testa a configuração importa DEFAULT_TERMS", () => {
    const offenders = files
      .filter((f) => /\bDEFAULT_TERMS\b/.test(f.code))
      .map((f) => f.id)
      .filter((id) => !DEFAULT_TERMS_PERMITIDO.includes(id));

    expect(offenders).toEqual([]);
  });

  /** Toda tela ou componente pega os termos resolvidos, por contexto ou por prop. */
  it("nenhuma tela importa vocabulário estático", () => {
    const telas = files.filter((f) => f.id.startsWith("app/") && !f.id.endsWith(".test.ts"));
    const offenders = telas
      .filter((f) => /import \{[^}]*\bterms\b[^}]*\} from "@\/lib\/terms"/.test(f.code))
      .map((f) => f.id);

    expect(offenders).toEqual([]);
  });
});
