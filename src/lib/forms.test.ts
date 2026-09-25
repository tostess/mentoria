import { describe, expect, it } from "vitest";
import {
  CampoInvalido,
  cnpjOpcional,
  dataOpcional,
  email,
  falha,
  id,
  inteiro,
  lista,
  opcao,
  sucesso,
  texto,
  textoOpcional,
  validando,
} from "./forms";

/**
 * Validação da borda. Server Action é POST público: o que estes testes cobrem
 * não é o usuário digitando errado — é o POST forjado que pula a tela.
 */

function form(campos: Record<string, string>): FormData {
  const data = new FormData();
  for (const [chave, valor] of Object.entries(campos)) data.append(chave, valor);
  return data;
}

describe("texto", () => {
  it("apara espaço em volta", () => {
    expect(texto(form({ nome: "  Ana  " }), "nome", "o nome")).toBe("Ana");
  });

  it("trata campo só de espaço como ausente", () => {
    expect(() => texto(form({ nome: "   " }), "nome", "o nome")).toThrow(CampoInvalido);
  });

  it("trata campo ausente como ausente, e não como string vazia", () => {
    expect(() => texto(form({}), "nome", "o nome")).toThrow("Preencha o nome.");
  });

  it("recusa texto acima do limite da coluna", () => {
    expect(() => texto(form({ nome: "a".repeat(200) }), "nome", "o nome", 160)).toThrow(
      CampoInvalido,
    );
  });

  it("opcional devolve null, não string vazia — a coluna não guarda ''", () => {
    expect(textoOpcional(form({ cargo: "" }), "cargo")).toBeNull();
  });
});

describe("email", () => {
  it("normaliza para minúsculas", () => {
    expect(email(form({ email: "Ana@Empresa.COM.BR" }), "email")).toBe("ana@empresa.com.br");
  });

  it.each(["sem-arroba", "sem@dominio", "a@b", "espaço @x.com", "@x.com", "a@.com"])(
    "recusa %s",
    (valor) => {
      expect(() => email(form({ email: valor }), "email")).toThrow(CampoInvalido);
    },
  );

  it("aceita endereço com subdomínio e sinal de mais", () => {
    expect(email(form({ email: "ana+rh@mail.empresa.com.br" }), "email")).toBe(
      "ana+rh@mail.empresa.com.br",
    );
  });
});

describe("inteiro", () => {
  it("lê número dentro da faixa", () => {
    expect(inteiro(form({ n: "120" }), "n", "A quantidade", 1, 1000)).toBe(120);
  });

  it("recusa abaixo do mínimo — zero ficha não é lançamento", () => {
    expect(() => inteiro(form({ n: "0" }), "n", "A quantidade", 1, 6)).toThrow(
      "A quantidade precisa estar entre 1 e 6.",
    );
  });

  it("recusa acima do teto", () => {
    expect(() => inteiro(form({ n: "7" }), "n", "A quantidade", 1, 6)).toThrow(CampoInvalido);
  });

  it("recusa decimal — meia ficha não existe", () => {
    expect(() => inteiro(form({ n: "1.5" }), "n", "A quantidade", 1, 6)).toThrow(CampoInvalido);
  });

  it("recusa notação científica, que o Number aceitaria", () => {
    expect(() => inteiro(form({ n: "1e3" }), "n", "A quantidade", 1, 10_000)).toThrow(
      CampoInvalido,
    );
  });

  it("recusa vazio em vez de virar zero", () => {
    expect(() => inteiro(form({ n: "" }), "n", "A quantidade", 1, 6)).toThrow("Preencha");
  });
});

describe("id", () => {
  it("aceita uuid e normaliza caixa", () => {
    expect(id(form({ orgId: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE" }), "orgId", "A empresa")).toBe(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
  });

  it("recusa o que não é uuid, inclusive tentativa de SQL", () => {
    expect(() => id(form({ orgId: "1 or 1=1" }), "orgId", "A empresa")).toThrow(CampoInvalido);
    expect(() => id(form({}), "orgId", "A empresa")).toThrow(CampoInvalido);
  });
});

describe("dataOpcional", () => {
  it("aceita YYYY-MM-DD e devolve como veio, sem passar por Date", () => {
    expect(dataOpcional(form({ d: "2026-09-01" }), "d", "A data")).toBe("2026-09-01");
  });

  it("devolve null quando em branco", () => {
    expect(dataOpcional(form({ d: "" }), "d", "A data")).toBeNull();
  });

  /** O `Date` normalizaria 31/02 para 03/03 em silêncio. */
  it("recusa dia que não existe no mês", () => {
    expect(() => dataOpcional(form({ d: "2026-02-31" }), "d", "A data")).toThrow(CampoInvalido);
  });

  it("recusa formato brasileiro, que o input date nunca manda", () => {
    expect(() => dataOpcional(form({ d: "01/09/2026" }), "d", "A data")).toThrow(CampoInvalido);
  });
});

describe("cnpjOpcional", () => {
  it("guarda só os dígitos", () => {
    expect(cnpjOpcional(form({ cnpj: "12.345.678/0001-90" }), "cnpj")).toBe("12345678000190");
  });

  it("aceita já sem pontuação", () => {
    expect(cnpjOpcional(form({ cnpj: "12345678000190" }), "cnpj")).toBe("12345678000190");
  });

  it("recusa contagem de dígitos errada", () => {
    expect(() => cnpjOpcional(form({ cnpj: "123" }), "cnpj")).toThrow(CampoInvalido);
  });

  it("devolve null quando em branco", () => {
    expect(cnpjOpcional(form({ cnpj: "" }), "cnpj")).toBeNull();
  });
});

describe("lista", () => {
  it("separa por vírgula e apara", () => {
    expect(lista(form({ areas: "Liderança , Saúde " }), "areas")).toEqual(["Liderança", "Saúde"]);
  });

  it("descarta vazio e repetido", () => {
    expect(lista(form({ areas: "A,,B,A," }), "areas")).toEqual(["A", "B"]);
  });

  it("devolve array vazio quando em branco — a coluna tem default '{}'", () => {
    expect(lista(form({ areas: "" }), "areas")).toEqual([]);
  });

  it("recusa lista acima do limite", () => {
    expect(() => lista(form({ areas: "a,b,c,d" }), "areas", 3)).toThrow(CampoInvalido);
  });
});

describe("opcao", () => {
  const VALIDAS = ["voluntario", "parceria", "remunerado"] as const;

  it("aceita valor do conjunto", () => {
    expect(opcao(form({ v: "parceria" }), "v", "o vínculo", VALIDAS)).toBe("parceria");
  });

  it("recusa valor de fora — o enum do banco não perdoa", () => {
    expect(() => opcao(form({ v: "socio" }), "v", "o vínculo", VALIDAS)).toThrow(CampoInvalido);
  });
});

describe("validando", () => {
  it("transforma CampoInvalido em mensagem para a tela", async () => {
    const estado = await validando(async () => {
      throw new CampoInvalido("Preencha o nome.");
    });
    expect(estado).toEqual(falha("Preencha o nome."));
  });

  /**
   * O que importa aqui: falha de banco **não** vira "confira os campos". Ela
   * sobe, e o Next mostra erro de verdade em vez de culpar o preenchimento.
   */
  it("deixa passar qualquer outro erro", async () => {
    await expect(
      validando(async () => {
        throw new Error("conexão recusada");
      }),
    ).rejects.toThrow("conexão recusada");
  });

  it("devolve o sucesso quando nada estoura", async () => {
    const estado = await validando(async () => sucesso("Feito."));
    expect(estado).toEqual({ erro: null, ok: "Feito.", credencial: null });
  });
});
