import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { accentLine, DEFAULT_THEME, misturar, resolveTheme, variaveisDoTema } from "./theme";

/**
 * Cor é token, não hex (F4, 07/10/2026).
 *
 * Cada empresa tem a própria marca, e a cor chega ao componente como variável
 * (`bg-accent`, `text-stone`). Um hex escrito no componente é uma cor que a
 * marca do cliente não alcança — eram 35 magentas assim antes da F4, aparecendo
 * na casca verde da Faculdade Aurora. Esta varredura impede a volta.
 */

const SRC = join(__dirname, "..");

function arquivos(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return arquivos(full, ext);
    return entry.name.endsWith(ext) ? [full] : [];
  });
}

/** A galeria de design mostra cores de exemplo de propósito; é só de dev. */
const IGNORADOS = ["app/design/"];

const componentes = [...arquivos(join(SRC, "app"), ".tsx"), ...arquivos(join(SRC, "components"), ".tsx")]
  .map((path) => ({ id: relative(SRC, path).split(sep).join("/"), code: readFileSync(path, "utf8") }))
  .filter((f) => !IGNORADOS.some((prefixo) => f.id.startsWith(prefixo)));

/**
 * Hex em string fora de classe, com o motivo de cada exceção: o valor inicial
 * do campo de cor da empresa é dado, não estilo.
 */
const HEX_EM_STRING_PERMITIDO = ["components/admin/NovaEmpresaForm.tsx"];

const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");

function variavelNoCss(nome: string): string | null {
  const m = new RegExp(`${nome}:\\s*(#[0-9A-Fa-f]{6,8});`).exec(css);
  return m ? m[1].toUpperCase() : null;
}

describe("cor é token", () => {
  it("encontrou os componentes", () => {
    expect(componentes.length).toBeGreaterThan(40);
  });

  it("nenhum hex em classe de componente", () => {
    const ofensores = componentes.flatMap((f) =>
      (f.code.match(/\[#[0-9A-Fa-f]{3,8}\]/g) ?? []).map((hex) => `${f.id}: ${hex}`),
    );
    expect(ofensores).toEqual([]);
  });

  it("nenhum hex em string de componente, fora das exceções", () => {
    const ofensores = componentes
      .filter((f) => !HEX_EM_STRING_PERMITIDO.includes(f.id))
      .flatMap((f) => (f.code.match(/["'`]#[0-9A-Fa-f]{3,8}["'`]/g) ?? []).map((hex) => `${f.id}: ${hex}`));
    expect(ofensores).toEqual([]);
  });

  it("o default do globals.css é o tema padrão — as duas fontes não podem divergir", () => {
    const diferencas = Object.entries(variaveisDoTema(DEFAULT_THEME))
      .filter(([nome, valor]) => variavelNoCss(nome) !== valor.toUpperCase())
      .map(([nome, valor]) => `${nome}: css ${variavelNoCss(nome)} ≠ tema ${valor}`);
    expect(diferencas).toEqual([]);
  });

  it("toda variável da marca vira cor do Tailwind", () => {
    const semToken = Object.keys(variaveisDoTema(DEFAULT_THEME))
      .map((nome) => nome.replace("--cor-", ""))
      .filter((token) => !css.includes(`--color-${token}: var(--cor-${token});`));
    expect(semToken).toEqual([]);
  });
});

describe("tons derivados do accent", () => {
  it("o tema padrão produz os tons de antes, exatos", () => {
    const v = variaveisDoTema(DEFAULT_THEME);
    expect(v["--cor-accent-10"]).toBe("#C2317A1A");
    expect(v["--cor-accent-12"]).toBe("#C2317A1F");
    expect(v["--cor-on-accent"]).toBe("#FFFFFF");
    expect(v["--cor-on-soft"]).toBe("#C2317A");
    expect(v["--cor-accent-line"]).toBe("#E7B3CC");
  });

  it("a marca da empresa muda o accent e os tons que saem dele", () => {
    const v = variaveisDoTema(resolveTheme({ accent: "#2E6B52", name: null, logoUrl: null }));
    expect(v["--cor-accent"]).toBe("#2E6B52");
    expect(v["--cor-accent-10"]).toBe("#2E6B521A");
    expect(v["--cor-accent-line"]).toBe(misturar("#2E6B52", "#FFFFFF", 0.38));
  });

  it("accent claro ganha texto escuro por cima", () => {
    expect(variaveisDoTema(resolveTheme({ accent: "#F2D16B", name: null, logoUrl: null }))["--cor-on-accent"]).toBe(
      DEFAULT_THEME.ink,
    );
  });

  it("misturar resolve a opacidade em hex opaco", () => {
    expect(misturar("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(misturar("#C2317A", "#FFFFFF", 0)).toBe("#FFFFFF");
    expect(misturar("#C2317A", "#FFFFFF", 1)).toBe("#C2317A");
  });

  it("a borda derivada fica a menos de 2 pontos por canal do tom escolhido à mão", () => {
    const calculada = misturar(DEFAULT_THEME.accent, "#FFFFFF", 0.38);
    const canais = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const desvio = canais(calculada).map((c, i) => Math.abs(c - canais(accentLine(DEFAULT_THEME.accent))[i]));
    expect(Math.max(...desvio)).toBeLessThanOrEqual(2);
  });
});
