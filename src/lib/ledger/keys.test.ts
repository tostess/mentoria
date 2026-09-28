import { describe, expect, it } from "vitest";
import {
  ChaveInvalida,
  chaveAjuste,
  chaveEstorno,
  chaveGasto,
  chaveAlocacaoManual,
  chaveAlocacaoMensal,
  chaveCompra,
  periodo,
} from "./keys";

/**
 * Invariante 16: trabalho agendado é idempotente por `idempotency_key` única.
 *
 * O que estes testes protegem não é o formato da string — é a separação entre
 * a chave do cron e a da mão humana. Se as duas colidissem, a primeira
 * alocação manual do mês silenciaria a automática, sem erro nenhum.
 */

const USER = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const TOKEN = "3f2b91ca-7d4e-4a1b-9c0d-5e6f7a8b9c0d";
const BOOKING = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("periodo", () => {
  it("formata YYYYMM com mês de dois dígitos", () => {
    expect(periodo(2026, 9)).toBe("202609");
    expect(periodo(2026, 12)).toBe("202612");
  });

  it("recusa mês fora da faixa", () => {
    expect(() => periodo(2026, 0)).toThrow(ChaveInvalida);
    expect(() => periodo(2026, 13)).toThrow(ChaveInvalida);
  });

  it("recusa mês fracionário — 9.5 não é um mês", () => {
    expect(() => periodo(2026, 9.5)).toThrow(ChaveInvalida);
  });

  it("recusa ano implausível", () => {
    expect(() => periodo(26, 9)).toThrow(ChaveInvalida);
  });
});

describe("chave do cron", () => {
  it("segue o formato fixado pela invariante 16", () => {
    expect(chaveAlocacaoMensal(USER, 2026, 9)).toBe(`alloc_${USER}_202609`);
  });

  it("é a mesma na segunda execução do mesmo mês — é o que impede a duplicata", () => {
    expect(chaveAlocacaoMensal(USER, 2026, 9)).toBe(chaveAlocacaoMensal(USER, 2026, 9));
  });

  it("muda de mês para mês", () => {
    expect(chaveAlocacaoMensal(USER, 2026, 9)).not.toBe(chaveAlocacaoMensal(USER, 2026, 10));
  });
});

describe("chave da mão humana", () => {
  it("é estável para o mesmo token — reenviar o formulário colide", () => {
    expect(chaveAlocacaoManual(USER, TOKEN)).toBe(chaveAlocacaoManual(USER, TOKEN));
  });

  it("muda com o token — abrir a tela de novo permite a segunda alocação", () => {
    expect(chaveAlocacaoManual(USER, TOKEN)).not.toBe(
      chaveAlocacaoManual(USER, "99999999-9999-4999-8999-999999999999"),
    );
  });

  /**
   * O ponto do arquivo. Estas duas chaves nascem do mesmo usuário e do mesmo
   * mês, e têm de ser diferentes: se fossem iguais, alocar à mão em setembro
   * faria o cron de setembro achar que já rodou.
   */
  it("nunca colide com a chave do cron do mesmo usuário e mês", () => {
    const manual = chaveAlocacaoManual(USER, TOKEN);
    const mensal = chaveAlocacaoMensal(USER, 2026, 9);
    expect(manual).not.toBe(mensal);
    expect(manual.startsWith("alloc_")).toBe(false);
  });

  it("recusa token curto demais para ser sorteado", () => {
    expect(() => chaveAlocacaoManual(USER, "abc")).toThrow(ChaveInvalida);
  });

  it("recusa token com caractere que não é de uuid", () => {
    expect(() => chaveAlocacaoManual(USER, "token com espaço")).toThrow(ChaveInvalida);
    expect(() => chaveAlocacaoManual(USER, "tok_en/../../etc")).toThrow(ChaveInvalida);
  });

  it("normaliza maiúsculas, para o mesmo token não virar duas chaves", () => {
    expect(chaveAlocacaoManual(USER, TOKEN.toUpperCase())).toBe(chaveAlocacaoManual(USER, TOKEN));
  });
});

describe("chaves por tipo de lançamento", () => {
  it("compra e alocação do mesmo token não se confundem", () => {
    expect(chaveCompra(ORG, TOKEN)).not.toBe(chaveAlocacaoManual(ORG, TOKEN));
  });

  it("ajuste tem prefixo próprio — correção é lançamento novo (invariante 3)", () => {
    expect(chaveAjuste(USER, TOKEN)).toBe(`adjust_${USER}_${TOKEN}`);
  });
});

describe("chave do gasto", () => {

  /**
   * A reserva tem identificador natural — uma sessão, um gasto —, então a chave
   * é o próprio `booking_id` e não um token de formulário. Reenviar o mesmo
   * pedido de reserva colide, que é o que se quer.
   */
  it("é o booking_id, com prefixo próprio", () => {
    expect(chaveGasto(BOOKING)).toBe(`spend_${BOOKING}`);
  });

  it("normaliza a caixa — o mesmo id não pode virar duas chaves", () => {
    expect(chaveGasto(BOOKING.toUpperCase())).toBe(chaveGasto(BOOKING));
  });

  it("recusa o que não é uuid", () => {
    expect(() => chaveGasto("123")).toThrow(ChaveInvalida);
    expect(() => chaveGasto("")).toThrow(ChaveInvalida);
  });

  it("não colide com as outras chaves do mesmo identificador", () => {
    expect(chaveGasto(BOOKING)).not.toBe(chaveAjuste(BOOKING, TOKEN));
    expect(chaveGasto(BOOKING).startsWith("alloc")).toBe(false);
  });
});

describe("chave de estorno", () => {
  it("é uma por sessão, no formato refund_{bookingId}", () => {
    expect(chaveEstorno(BOOKING)).toBe(`refund_${BOOKING}`);
    expect(chaveEstorno(BOOKING.toUpperCase())).toBe(chaveEstorno(BOOKING));
  });

  it("não depende do caminho: não há parâmetro para recusa ou expiração", () => {
    // A garantia de um estorno só por sessão mora na aridade. Um segundo
    // parâmetro seria a porta para `decline_` e `expire_` coexistirem.
    expect(chaveEstorno.length).toBe(1);
  });

  it("não colide com o gasto da mesma sessão", () => {
    expect(chaveEstorno(BOOKING)).not.toBe(chaveGasto(BOOKING));
  });

  it("recusa o que não é uuid", () => {
    expect(() => chaveEstorno("abc")).toThrow(ChaveInvalida);
  });
});
