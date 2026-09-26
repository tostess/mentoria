import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O cenário de teste vive em `src/` — e por isso precisa de uma cerca.
 *
 * Ele está lá porque três suítes montam a mesma empresa, o mesmo Profissional
 * com carteira e o mesmo Parceiro com rotina, e a terceira cópia dos seeds seria
 * a terceira chance de elas divergirem sem ninguém notar. O preço é que um
 * módulo com `insert into auth.users` passa a ser importável pelo produto.
 *
 * Esta varredura é a cerca. Na mesma linha do que já guarda a invariante 5 e o
 * vocabulário: o que o teste não alcança por comportamento, alcança por leitura
 * do código-fonte.
 */

const SRC = join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
  });
}

const fontes = arquivos(SRC).map((caminho) => ({
  id: relative(SRC, caminho).split(sep).join("/"),
  codigo: readFileSync(caminho, "utf8"),
}));

const ehTeste = (id: string) => id.endsWith(".test.ts") || id.endsWith(".test.tsx");

describe("cenário de teste", () => {
  it("achou o código-fonte", () => {
    expect(fontes.length).toBeGreaterThan(10);
  });

  it("só testes importam `cenario-de-teste`", () => {
    const infratores = fontes
      .filter((f) => !ehTeste(f.id) && f.id !== "lib/db/cenario-de-teste.ts")
      .filter((f) => /cenario-de-teste/.test(f.codigo))
      .map((f) => f.id);

    expect(infratores).toEqual([]);
  });

  /**
   * `insert into auth.users` é coisa de seed. Fora do cenário e dos testes, quem
   * cria identidade é o servidor de auth por `pessoas/criar.ts` — inserir na mão
   * produziria conta sem senha, invisível até alguém tentar entrar.
   */
  it("ninguém mais escreve em `auth.users`", () => {
    const infratores = fontes
      .filter((f) => !ehTeste(f.id) && f.id !== "lib/db/cenario-de-teste.ts")
      .filter((f) => /insert\s+into\s+auth\.users/i.test(f.codigo))
      .map((f) => f.id);

    expect(infratores).toEqual([]);
  });
});
