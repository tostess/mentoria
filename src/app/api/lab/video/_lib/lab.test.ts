import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { labAberto, labFechado } from "./cerca";

/**
 * Cerca do SPIKE P5-0, travada por teste — na linha do que guarda a
 * invariante 5 em `lib/supabase/server-only.test.ts`.
 *
 * 1. Toda rota de `api/lab/video` e toda página de `lab/video` passam pela
 *    cerca **antes de qualquer coisa**, e a cerca fecha com
 *    `VERCEL_ENV === "production"`.
 * 2. A chave e o segredo do Daily só são lidos em `servidor.ts`, que é
 *    `server-only`, e nunca sob `NEXT_PUBLIC_`.
 * 3. Nada fora do lab importa o lab: apagar as duas pastas apaga o spike
 *    inteiro sem quebrar o produto.
 */

const SRC = join(process.cwd(), "src");
const API_LAB = "app/api/lab/video/";
const PAGINAS_LAB = "app/lab/video/";

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

const doLab = (id: string) => id.startsWith(API_LAB) || id.startsWith(PAGINAS_LAB);
const rotas = files.filter((f) => f.id.startsWith(API_LAB) && f.id.endsWith("/route.ts"));
const paginas = files.filter((f) => f.id.startsWith(PAGINAS_LAB) && f.id.endsWith("/page.tsx"));

const METODOS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS";

describe("cerca do lab de vídeo — 404 em produção", () => {
  const original = process.env.VERCEL_ENV;
  afterEach(() => {
    if (original === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = original;
  });

  it("encontrou as rotas e a página do lab", () => {
    expect(rotas.length).toBeGreaterThanOrEqual(4);
    expect(paginas.length).toBeGreaterThanOrEqual(1);
  });

  it("fecha com 404 em produção e abre no Preview e no desenvolvimento", async () => {
    process.env.VERCEL_ENV = "production";
    expect(labAberto()).toBe(false);
    expect(labFechado()?.status).toBe(404);

    for (const ambiente of ["preview", "development", undefined]) {
      if (ambiente === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = ambiente;
      expect(labAberto()).toBe(true);
      expect(labFechado()).toBeNull();
    }
  });

  it("a cerca decide por VERCEL_ENV, não por NODE_ENV", () => {
    const cerca = files.find((f) => f.id === `${API_LAB}_lib/cerca.ts`);
    expect(cerca?.code).toMatch(/process\.env\.VERCEL_ENV !== "production"/);
    expect(cerca?.code).not.toMatch(/process\.env\.NODE_ENV/);
  });

  it("todo handler de rota começa pela cerca", () => {
    const semCerca = rotas.flatMap((f) => {
      const handlers = [...f.code.matchAll(new RegExp(`export async function (${METODOS})\\b`, "g"))];
      const cercados = [
        ...f.code.matchAll(
          new RegExp(
            `export async function (${METODOS})\\([^)]*\\)\\s*\\{\\s*const fechado = labFechado\\(\\);\\s*if \\(fechado\\) return fechado;`,
            "g",
          ),
        ),
      ];
      const faltando = handlers.map((h) => h[1]).filter((m) => !cercados.some((c) => c[1] === m));
      return faltando.map((m) => `${f.id}: ${m}`);
    });

    expect(semCerca).toEqual([]);
  });

  it("nenhum handler escapa da varredura por outra forma de exportar", () => {
    const outrasFormas = rotas
      .filter((f) => new RegExp(`export (const|let|\\{)[^\\n]*\\b(${METODOS})\\b`).test(f.code))
      .map((f) => f.id);

    expect(outrasFormas).toEqual([]);
  });

  it("toda página do lab começa pela cerca", () => {
    const semCerca = paginas
      .filter(
        (f) => !/export default (async )?function \w+\([^)]*\)\s*\{\s*if \(!labAberto\(\)\) notFound\(\);/.test(f.code),
      )
      .map((f) => f.id);

    expect(semCerca).toEqual([]);
  });
});

describe("cerca do lab de vídeo — segredos só no servidor", () => {
  const NOMES = ["DAILY_API_KEY", "DAILY_WEBHOOK_SECRET"];
  const PERMITIDOS = [`${API_LAB}_lib/servidor.ts`, `${API_LAB}_lib/lab.test.ts`];

  it("só `servidor.ts` lê a chave e o segredo do Daily", () => {
    const leitores = files
      .filter((f) => NOMES.some((n) => f.code.includes(n)))
      .map((f) => f.id)
      .filter((id) => !PERMITIDOS.includes(id));

    expect(leitores).toEqual([]);
  });

  it("`servidor.ts` declara `server-only`", () => {
    const servidor = files.find((f) => f.id === `${API_LAB}_lib/servidor.ts`);
    expect(servidor?.code).toContain('import "server-only"');
  });

  it("nada do Daily sob NEXT_PUBLIC_", () => {
    const expostos = files.filter((f) => /NEXT_PUBLIC_DAILY/.test(f.code)).map((f) => f.id);
    expect(expostos.filter((id) => !PERMITIDOS.includes(id))).toEqual([]);
  });

  it("nenhum componente cliente importa o módulo que lê os segredos", () => {
    const vazamentos = files
      .filter((f) => /^\s*["']use client["']/m.test(f.code))
      .filter((f) => /from ["'][^"']*_lib\/servidor["']/.test(f.code))
      .map((f) => f.id);

    expect(vazamentos).toEqual([]);
  });
});

describe("cerca do lab de vídeo — o spike morre inteiro", () => {
  it("nada fora do lab importa código do lab", () => {
    const dependentes = files
      .filter((f) => !doLab(f.id))
      .filter((f) => /from ["'](@\/app\/api\/lab|@\/app\/lab|[^"']*\/lab\/video)/.test(f.code))
      .map((f) => f.id);

    expect(dependentes).toEqual([]);
  });
});
