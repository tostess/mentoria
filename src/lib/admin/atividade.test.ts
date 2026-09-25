import { describe, expect, it } from "vitest";
import { DEFAULT_TERMS, type Terms } from "@/lib/terms";
import { ACOES_AUDITADAS, descrever, rotuloDaAcao, type EventoDeAtividade } from "./atividade";

const t = DEFAULT_TERMS;

function evento(acao: string, extra: Partial<EventoDeAtividade> = {}): EventoDeAtividade {
  return {
    acao,
    autor: "João Paulo Ferreira",
    alvo: "Helena Braga",
    empresa: "Faculdade Aurora",
    antes: null,
    depois: null,
    ...extra,
  };
}

function frase(ev: EventoDeAtividade, termos: Terms = t): string {
  return descrever(ev, termos)
    .partes.map((p) => p.texto)
    .join("");
}

describe("catálogo de ações auditadas", () => {
  it.each(ACOES_AUDITADAS)("%s vira frase sem sublinhado", (acao) => {
    const texto = frase(evento(acao, { depois: { quantidade: 2, fichas: 120, status: "paused" } }));
    expect(texto).not.toMatch(/_/);
    expect(texto.startsWith("João Paulo Ferreira ")).toBe(true);
  });

  it.each(ACOES_AUDITADAS)("%s tem rótulo curto sem sublinhado", (acao) => {
    expect(rotuloDaAcao(acao, t)).not.toMatch(/_/);
  });

  it("alocação diz quanto, para quem e de qual empresa", () => {
    expect(
      frase(evento("alocar_fichas", { alvo: "Mariana Costa", depois: { quantidade: 2 } })),
    ).toBe("João Paulo Ferreira alocou 2 fichas para Mariana Costa · Faculdade Aurora");
  });

  it("singular de ficha usa o termo no singular", () => {
    expect(frase(evento("alocar_fichas", { depois: { quantidade: 1 } }))).toContain("1 ficha ");
  });

  it("compra diz o tamanho do bloco e a empresa", () => {
    expect(frase(evento("registrar_compra", { alvo: null, depois: { fichas: 120 } }))).toBe(
      "João Paulo Ferreira registrou 120 fichas no contrato de Faculdade Aurora",
    );
  });

  it("usa os termos da empresa, nunca o literal", () => {
    const mentoria: Terms = { ...t, partner: "Mentor", fichas: "créditos", ficha: "crédito" };
    expect(frase(evento("criar_parceiro"), mentoria)).toBe(
      "João Paulo Ferreira criou o Mentor Helena Braga",
    );
    expect(frase(evento("alocar_fichas", { depois: { quantidade: 3 } }), mentoria)).toContain(
      "3 créditos",
    );
  });

  it("nomes próprios e quantidades vêm marcados como fortes", () => {
    const { partes } = descrever(evento("alocar_fichas", { depois: { quantidade: 2 } }), t);
    expect(partes.filter((p) => p.forte).map((p) => p.texto)).toEqual([
      "João Paulo Ferreira",
      "2 fichas",
      "Helena Braga",
    ]);
  });

  it("edição lista os campos alterados com nome de gente", () => {
    const texto = frase(
      evento("editar_parceiro", {
        depois: { headline: "Nova", areas: ["Saúde"], maxPorSemana: 5 },
      }),
    );
    expect(texto).toBe(
      "João Paulo Ferreira editou o Parceiro Helena Braga — chamada, áreas, teto semanal",
    );
  });

  it("status escolhe verbo e ícone pelo estado novo", () => {
    const pausar = descrever(
      evento("alterar_status_parceiro", { depois: { status: "paused" } }),
      t,
    );
    const arquivar = descrever(
      evento("alterar_status_parceiro", { depois: { status: "archived" } }),
      t,
    );
    const reativar = descrever(
      evento("alterar_status_parceiro", { depois: { status: "active" } }),
      t,
    );

    expect(pausar.icone).toBe("pause");
    expect(arquivar.icone).toBe("archive");
    expect(arquivar.tom).toBe("bad");
    expect(reativar.icone).toBe("reactivate");
    expect(frase(evento("alterar_status_parceiro", { depois: { status: "archived" } }))).toContain(
      "arquivou o Parceiro Helena Braga",
    );
  });

  it("perfil apagado cai no nome gravado no after", () => {
    expect(
      frase(evento("criar_parceiro", { alvo: null, depois: { nome: "Rafael Souza" } })),
    ).toContain("Rafael Souza");
  });

  it("sem autor é o trabalho agendado", () => {
    expect(frase(evento("alocar_fichas", { autor: null, depois: { quantidade: 2 } }))).toMatch(
      /^Trabalho agendado alocou/,
    );
  });

  it("código desconhecido sai humanizado, nunca cru", () => {
    const d = descrever(evento("mesclar_contas_antigas"), t);
    expect(d.icone).toBe("history");
    expect(frase(evento("mesclar_contas_antigas"))).toBe(
      "João Paulo Ferreira — mesclar contas antigas",
    );
  });

  it("não confunde propriedade herdada com ação", () => {
    expect(frase(evento("toString"))).toBe("João Paulo Ferreira — tostring");
  });
});
