import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { paraJsonb } from "./jsonb";

/**
 * A armadilha do jsonb, travada por varredura de código.
 *
 * Por que não por comportamento: o modo de falha que custou esta sessão só
 * aparece **dentro do bundle do Next**. Em Node puro — que é onde o Vitest
 * roda — `tx.json()` funciona nos dois poolers e passa em qualquer teste de
 * integração. Foi exatamente por isso que passou despercebido até a tela ser
 * exercitada de verdade.
 *
 * Um teste que roda no mesmo lugar do bug não existe aqui. O que existe é
 * impedir a forma errada de voltar ao código.
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

/**
 * A regra vale para o código da aplicação, não para os testes.
 *
 * Teste roda em Node puro, onde `tx.json()` funciona — e em
 * `lib/auth/hook.test.ts` ele é obrigatório: lá o jsonb é **argumento de
 * função**, e sem `tx.json()` o postgres.js manda a string e o hook não acha
 * `user_id`. Foi o tropeço anotado na Etapa 4.
 */
const ehTeste = (id: string) => id.endsWith(".test.ts");
const PERMITIDO = ["lib/db/jsonb.ts"];

describe("escrita em coluna jsonb", () => {
  it("achou o código-fonte", () => {
    expect(fontes.length).toBeGreaterThan(10);
  });

  /**
   * `tx.json(x)` é o que a documentação do postgres.js manda usar, funciona em
   * Node e **estoura dentro do Next** com `ERR_INVALID_ARG_TYPE`. Quem escrever
   * isso de novo só descobre abrindo a tela.
   */
  it("ninguém chama `.json()` do postgres.js", () => {
    const infratores = fontes
      .filter((f) => !PERMITIDO.includes(f.id) && !ehTeste(f.id))
      .filter((f) => /\b(tx|sql|client)\.json\s*\(/.test(f.codigo))
      .map((f) => f.id);

    expect(infratores).toEqual([]);
  });

  /**
   * `${JSON.stringify(x)}::jsonb` sem o `::text` no meio grava a **string**
   * JSON como valor jsonb. Não dá erro: o dado entra torto e só aparece quando
   * alguém lê `branding->>'accent'` e recebe nada.
   */
  it("todo uso de paraJsonb vem com ::text::jsonb", () => {
    const infratores = fontes
      .filter((f) => !PERMITIDO.includes(f.id) && !ehTeste(f.id))
      .flatMap((f) =>
        [...f.codigo.matchAll(/paraJsonb\([^)]*\)(.{0,16})/g)]
          // O `}` fecha a interpolação do template: `${paraJsonb(x)}::text::jsonb`.
          .filter((achado) => !achado[1].startsWith("}::text::jsonb"))
          .map(() => f.id),
      );

    expect(infratores).toEqual([]);
  });
});

describe("paraJsonb", () => {
  it("serializa objeto", () => {
    expect(paraJsonb({ accent: "#C2317A" })).toBe('{"accent":"#C2317A"}');
  });

  /** `null::text::jsonb` é NULL — e não o jsonb `'null'`, que seria um valor. */
  it("null e undefined viram NULL, não o jsonb 'null'", () => {
    expect(paraJsonb(null)).toBeNull();
    expect(paraJsonb(undefined)).toBeNull();
  });

  it("serializa array e escalar, que também são jsonb válidos", () => {
    expect(paraJsonb(["a", "b"])).toBe('["a","b"]');
    expect(paraJsonb(false)).toBe("false");
  });
});
