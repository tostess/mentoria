import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nenhum código de máquina como texto de tela.
 *
 * O painel mostrava `criar_parceiro` e o livro-caixa `purchase`, e ninguém
 * percebeu até alguém olhar a tela. Esta varredura lê o JSX e recusa texto
 * entre tags que pareça identificador: `snake_case`, ou uma palavra só em
 * mono que seja nome de tabela.
 *
 * É estática porque o modo de falha também é: o texto está escrito no
 * componente. Código que vem do banco e é traduzido em tempo de execução é
 * coberto pelos testes de `lib/admin/atividade` e `lib/ledger/rotulos`.
 */

const SRC = join(__dirname, "..");

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsx(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/** A galeria de design mostra nomes de token de propósito; é só de dev. */
const IGNORADOS = ["app/design/"];

const arquivos = [...tsx(join(SRC, "app")), ...tsx(join(SRC, "components"))]
  .map((path) => ({
    id: relative(SRC, path).split(sep).join("/"),
    code: readFileSync(path, "utf8"),
  }))
  .filter((f) => !IGNORADOS.some((prefixo) => f.id.startsWith(prefixo)));

/** Texto entre `>` e `<` que é um identificador com sublinhado. */
const SNAKE_NO_JSX = />\s*([a-z]+_[a-z_]+)\s*</g;

/** Nomes de tabela que já apareceram em texto de tela. */
const TABELAS = /(>|\s)(audit_logs|org_ledger|wallet_ledger|org_wallets)(<|\s|\.)/;

describe("texto de tela", () => {
  it("encontrou os componentes", () => {
    expect(arquivos.length).toBeGreaterThan(20);
  });

  it("nenhum snake_case entre tags", () => {
    const achados = arquivos.flatMap((f) =>
      [...f.code.matchAll(SNAKE_NO_JSX)].map((m) => `${f.id}: ${m[1]}`),
    );
    expect(achados).toEqual([]);
  });

  it("nenhum nome de tabela como texto", () => {
    const achados = arquivos.flatMap((f) =>
      f.code
        .split("\n")
        // Comentário explica o banco; o que se protege é o que vai para a tela.
        .filter((linha) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(linha))
        .filter((linha) => TABELAS.test(linha))
        .map((linha) => `${f.id}: ${linha.trim()}`),
    );
    expect(achados).toEqual([]);
  });

  it("a varredura pega o que diz pegar", () => {
    expect("<span>criar_parceiro</span>".match(SNAKE_NO_JSX)).not.toBeNull();
    expect('<span className="font-mono">audit_logs</span>').toMatch(TABELAS);
    expect("<span>Criar Parceiro</span>".match(SNAKE_NO_JSX)).toBeNull();
  });
});
