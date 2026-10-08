import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { brandingParaBanco, mergeBranding, parseBranding } from "@/lib/config/app-config";
import { contaPessoal, empresa, inRollback, operadora } from "@/lib/db/cenario-de-teste";
import {
  CORES_DA_MARCA,
  DEFAULT_THEME,
  ajustesDaMarca,
  contraste,
  paletaDoAccent,
  resolveTheme,
} from "@/lib/theme";
import { EmpresaInexistente, marcaNaTransacao, type MarcaDaEmpresa } from "./operacoes";
import { avisosDeContraste, logotipoValido, problemasDeLeitura } from "./regras";

/**
 * A marca da empresa (F4b): a paleta que sai do accent, as regras de leitura e
 * a escrita pela mesma função que a aplicação chama, desfeita no fim.
 */

const VERDE = "#2E6B52";

describe("paleta derivada do accent", () => {
  it("o accent padrão devolve o padrão, exato", () => {
    const paleta = paletaDoAccent(DEFAULT_THEME.accent);
    for (const cor of CORES_DA_MARCA) expect(paleta[cor]).toBe(DEFAULT_THEME[cor]);
  });

  it("marca verde não deixa fundo rosado: o fundo puxa para o verde", () => {
    const { mist, blush } = paletaDoAccent(VERDE);
    for (const hex of [mist, blush]) {
      const [r, g] = [1, 3].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(g).toBeGreaterThan(r);
    }
  });

  it.each(["#2E6B52", "#1D4ED8", "#E85D04", "#F2D16B", "#6B6B6B", "#7C3AED"])(
    "%s mantém o texto legível sobre o cartão e o fundo",
    (accent) => {
      const tema = resolveTheme({ accent, name: null, logoUrl: null });
      expect(contraste(tema.ink, tema.white)).toBeGreaterThan(12);
      expect(problemasDeLeitura(tema)).toEqual([]);
    },
  );

  it("accent cinza dá neutros cinza", () => {
    const { ink, mist, stone } = paletaDoAccent("#6B6B6B");
    for (const hex of [ink, mist, stone]) {
      expect(hex.slice(1, 3)).toBe(hex.slice(3, 5));
      expect(hex.slice(3, 5)).toBe(hex.slice(5, 7));
    }
  });

  it("o cartão continua branco", () => {
    expect(paletaDoAccent(VERDE).white).toBe("#FFFFFF");
  });
});

describe("ajuste fino", () => {
  it("guarda só a cor diferente da derivada", () => {
    const derivada = paletaDoAccent(VERDE);
    expect(ajustesDaMarca(VERDE, { ink: derivada.ink, mist: "#fafafa", line: "rosa" })).toEqual({
      mist: "#FAFAFA",
    });
  });

  it("vence a derivada no tema", () => {
    expect(resolveTheme({ accent: VERDE, name: null, logoUrl: null, cores: { mist: "#FAFAFA" } }).mist).toBe(
      "#FAFAFA",
    );
  });

  it("chega do banco filtrado: chave desconhecida e hex inválido somem", () => {
    expect(parseBranding({ cores: { mist: "fafafa", azul: "#0000FF", ink: "preto" } }).cores).toEqual({
      mist: "#FAFAFA",
    });
  });

  it("o da plataforma não vale para empresa com accent próprio", () => {
    const plataforma = parseBranding({ cores: { mist: "#FAFAFA" } });
    expect(mergeBranding(plataforma, parseBranding({ logo_url: "https://x.com/l.png" })).cores).toEqual({
      mist: "#FAFAFA",
    });
    expect(mergeBranding(plataforma, parseBranding({ accent: VERDE })).cores).toEqual({});
  });

  it("vai ao banco sem campo vazio, e marca vazia vira null", () => {
    expect(brandingParaBanco({ accent: VERDE, name: null, logoUrl: null, cores: {} })).toEqual({ accent: VERDE });
    expect(brandingParaBanco({ accent: null, name: null, logoUrl: null, cores: {} })).toBeNull();
  });
});

describe("regras de leitura", () => {
  it("texto claro sobre cartão branco não salva", () => {
    const tema = resolveTheme({ accent: VERDE, name: null, logoUrl: null, cores: { ink: "#DDDDDD" } });
    expect(problemasDeLeitura(tema)).toHaveLength(2);
  });

  it("accent amarelo salva, com aviso", () => {
    const tema = resolveTheme({ accent: "#F2D16B", name: null, logoUrl: null });
    expect(problemasDeLeitura(tema)).toEqual([]);
    expect(avisosDeContraste(tema)).toHaveLength(1);
  });

  it("o padrão não tem aviso", () => {
    expect(avisosDeContraste(DEFAULT_THEME)).toEqual([]);
  });

  it("logotipo só por https", () => {
    expect(logotipoValido("https://cdn.exemplo.com.br/logo.png")).toBe(true);
    expect(logotipoValido("http://cdn.exemplo.com.br/logo.png")).toBe(false);
    expect(logotipoValido("javascript:alert(1)")).toBe(false);
    expect(logotipoValido("https://localhost/logo.png")).toBe(false);
    expect(logotipoValido("logo.png")).toBe(false);
  });
});

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;

const VAZIA: MarcaDaEmpresa = { accent: null, nomeNaMarca: null, logotipo: null, cores: {} };

run("escrita da marca", () => {
  it("grava, audita só o que mudou e não grava nada quando nada muda", async () => {
    await inRollback(db!, async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const nova: MarcaDaEmpresa = {
        accent: VERDE,
        nomeNaMarca: "Aurora",
        logotipo: null,
        cores: { mist: "#FAFAFA", ink: paletaDoAccent(VERDE).ink },
      };

      const primeira = await marcaNaTransacao(tx, orgId, nova, ator);
      expect(primeira.campos).toEqual(["accent", "nomeNaMarca", "cores"]);

      const [org] = await tx<{ branding: unknown }[]>`select branding from orgs where id = ${orgId}`;
      // A cor igual à derivada não é guardada: trocar o accent depois a recalcula.
      expect(org.branding).toEqual({ accent: VERDE, name: "Aurora", cores: { mist: "#FAFAFA" } });

      const [log] = await tx<{ action: string; before: unknown; after: unknown }[]>`
        select action, before, after from audit_logs
         where entity_id = ${orgId} and action = 'editar_marca'`;
      expect(log.before).toEqual({ accent: null, nomeNaMarca: null, cores: {} });
      expect(log.after).toEqual({ accent: VERDE, nomeNaMarca: "Aurora", cores: { mist: "#FAFAFA" } });

      const segunda = await marcaNaTransacao(tx, orgId, nova, ator);
      expect(segunda.campos).toEqual([]);
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from audit_logs where entity_id = ${orgId} and action = 'editar_marca'`;
      expect(n).toBe(1);
    });
  });

  it("voltar à plataforma apaga a marca", async () => {
    await inRollback(db!, async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      await marcaNaTransacao(tx, orgId, { ...VAZIA, accent: VERDE }, ator);
      await marcaNaTransacao(tx, orgId, VAZIA, ator);
      const [org] = await tx<{ branding: unknown }[]>`select branding from orgs where id = ${orgId}`;
      expect(org.branding).toBeNull();
    });
  });

  it("a conta pessoal não tem marca própria", async () => {
    await inRollback(db!, async (tx) => {
      const ator = await operadora(tx);
      const { orgId } = await contaPessoal(tx, ator);
      await expect(marcaNaTransacao(tx, orgId, { ...VAZIA, accent: VERDE }, ator)).rejects.toBeInstanceOf(
        EmpresaInexistente,
      );
    });
  });
});
