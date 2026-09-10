import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Invariante 5 travada por teste: `service_role` só existe no servidor.
 *
 * A barreira de verdade é o `server-only`, que quebra o build. Isto aqui é a
 * rede embaixo dela — pega o vazamento antes do build e explica o porquê.
 */

const SRC = join(process.cwd(), "src");

/** Nomes que carregam a chave que ignora RLS — o novo e o legado. */
const SECRET_ENV_NAMES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

/** Onde o segredo pode ser lido, e em nenhum outro lugar. */
const SECRET_ALLOWED = ["lib/env.server.ts", "lib/supabase/server-only.test.ts"];

/** Módulos que carregam segredo ou conexão direta ao banco. */
const SERVER_ONLY_MODULES = [
  "@/lib/env.server",
  "@/lib/supabase/admin",
  "@/lib/supabase/server",
  "@/lib/db",
];

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

describe("invariante 5 — service_role só no servidor", () => {
  it("encontrou o código-fonte", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("só `env.server.ts` lê a chave secreta", () => {
    const offenders = files
      .filter((f) => SECRET_ENV_NAMES.some((name) => f.code.includes(name)))
      .map((f) => f.id)
      .filter((id) => !SECRET_ALLOWED.includes(id));

    expect(offenders).toEqual([]);
  });

  it("nenhum segredo é exposto sob NEXT_PUBLIC_", () => {
    const offenders = files
      .flatMap((f) => (f.code.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []).map((name) => ({ ...f, name })))
      .filter((hit) => /SERVICE|SECRET|PRIVATE|ROLE|PASSWORD|DATABASE/.test(hit.name))
      .map((hit) => `${hit.id}: ${hit.name}`);

    expect(offenders).toEqual([]);
  });

  it("nenhum componente cliente importa módulo de servidor", () => {
    const offenders = files
      .filter((f) => /^\s*["']use client["']/m.test(f.code))
      .flatMap((f) =>
        SERVER_ONLY_MODULES.filter((mod) =>
          new RegExp(`from ["']${mod}["']`).test(f.code),
        ).map((mod) => `${f.id} importa ${mod}`),
      );

    expect(offenders).toEqual([]);
  });

  it("todo módulo de servidor declara `server-only`", () => {
    const guarded = ["lib/env.server.ts", "lib/supabase/admin.ts", "lib/supabase/server.ts", "lib/db/index.ts"];
    const missing = guarded.filter((id) => {
      const file = files.find((f) => f.id === id);
      return !file || !file.code.includes('import "server-only"');
    });

    expect(missing).toEqual([]);
  });
});
