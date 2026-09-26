import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  darFichas,
  empresa,
  inRollback,
  operadora,
  parceiroComRotina,
  profissional,
} from "@/lib/db/cenario-de-teste";
import {
  HorarioIndisponivel,
  LimiteDePendentes,
  comTraducao,
  ehChaveRepetida,
  ehSaldoNegativo,
  ehSobreposicao,
} from "@/lib/ledger/erros";
import type { Limites } from "@/lib/scheduling";
import { ParceiroIndisponivel, ProfissionalInvalido, reservaNaTransacao } from "./operacoes";

/**
 * A reserva, contra o Postgres de verdade.
 *
 * Instante de referência **2026-09-25T12:00:00Z** — sexta-feira, 9h em São Paulo
 * (UTC−3, sem horário de verão). O Parceiro atende terça das 9h às 12h, então o
 * primeiro horário livre é terça 29/09 às 9h locais = **12:00Z**. Com aviso
 * mínimo de 12h, nada antes de sexta 21h local entra.
 *
 * A função chamada é a mesma que o Route Handler chama. O que o teste substitui é
 * só quem abre a transação — e ela sofre rollback, então o livro-caixa append-only
 * não é obstáculo.
 */

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;
const emRollback = <T,>(fn: (tx: postgres.TransactionSql) => Promise<T>) => inRollback(db!, fn);

const AGORA = new Date("2026-09-25T12:00:00Z");
const TERCA_9H = new Date("2026-09-29T12:00:00Z");
const TERCA_9H30 = new Date("2026-09-29T12:30:00Z");
const TERCA_10H = new Date("2026-09-29T13:00:00Z");
const TERCA = 2 as const;

const LIMITES: Limites = {
  horizonteDias: 14,
  avisoMinimoHoras: 12,
  duracaoMin: 30,
  passoMin: 30,
};

const ROTINA = [{ diaDaSemana: TERCA, inicioMin: 540, fimMin: 720 }];

/** Cenário completo: empresa com contrato, Profissional com fichas, Parceiro com rotina. */
async function cenario(
  tx: postgres.TransactionSql,
  opcoes: { naCarteira?: number; autoConfirm?: boolean; status?: string } = {},
) {
  const ator = await operadora(tx);
  const orgId = await empresa(tx, ator);
  const professionalId = await profissional(tx, orgId, ator);
  const partnerId = await parceiroComRotina(tx, ator, {
    regras: ROTINA,
    autoConfirm: opcoes.autoConfirm,
    status: opcoes.status,
  });
  await darFichas(tx, {
    orgId,
    userId: professionalId,
    ator,
    contrato: 10,
    naCarteira: opcoes.naCarteira ?? 2,
  });
  return { ator, orgId, professionalId, partnerId };
}

function pedido(
  base: { orgId: string; partnerId: string; professionalId: string },
  ajustes: { bookingId?: string; inicio?: Date; maxPendentes?: number } = {},
) {
  return {
    bookingId: ajustes.bookingId ?? crypto.randomUUID(),
    orgId: base.orgId,
    partnerId: base.partnerId,
    professionalId: base.professionalId,
    inicio: ajustes.inicio ?? TERCA_9H,
    agora: AGORA,
    limites: LIMITES,
    precoFichas: 1,
    maxPendentes: ajustes.maxPendentes ?? 2,
  };
}

/** Falha esperada sem envenenar a transação do teste. */
function esperandoFalha<T>(
  tx: postgres.TransactionSql,
  fn: (sp: postgres.TransactionSql) => Promise<T>,
): Promise<unknown> {
  return tx
    .savepoint(async (sp) => {
      await fn(sp);
      return null;
    })
    .then(() => null)
    .catch((falha: unknown) => falha);
}

run("reserva — invariante 6", () => {
  it("gasta a ficha e cria a sessão na mesma transação", async () => {
    const resultado = await emRollback(async (tx) => {
      const base = await cenario(tx);
      const reserva = await reservaNaTransacao(tx, pedido(base));

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${base.professionalId}`;
      const [lancamento] = await tx<
        { type: string; amount: number; booking_id: string | null }[]
      >`select type::text, amount, booking_id from wallet_ledger
          where user_id = ${base.professionalId} and type = 'spend'`;
      const [booking] = await tx<
        { status: string; price_fichas: number; duration_min: number; confirmed_at: string | null }[]
      >`select status::text, price_fichas, duration_min, confirmed_at from bookings
          where id = ${reserva.bookingId}`;

      return { reserva, carteira, lancamento, booking };
    });

    expect(resultado.reserva.status).toBe("pending");
    expect(resultado.reserva.inicio.toISOString()).toBe("2026-09-29T12:00:00.000Z");
    expect(resultado.reserva.fim.toISOString()).toBe("2026-09-29T12:30:00.000Z");
    // 2 alocadas, 1 gasta.
    expect(resultado.carteira.balance).toBe(1);
    expect(resultado.reserva.saldoCarteira).toBe(1);
    expect(resultado.lancamento.amount).toBe(-1);
    // O gasto aponta para a sessão — é o que liga livro-caixa e agenda.
    expect(resultado.lancamento.booking_id).toBe(resultado.reserva.bookingId);
    expect(resultado.booking.status).toBe("pending");
    expect(resultado.booking.price_fichas).toBe(1);
    expect(resultado.booking.duration_min).toBe(30);
    expect(resultado.booking.confirmed_at).toBeNull();
  });

  it("nasce confirmada quando o Parceiro confirma sozinho", async () => {
    const resultado = await emRollback(async (tx) => {
      const base = await cenario(tx, { autoConfirm: true });
      const reserva = await reservaNaTransacao(tx, pedido(base));
      const [booking] = await tx<{ status: string; confirmed_at: string | null }[]>`
        select status::text, confirmed_at from bookings where id = ${reserva.bookingId}`;
      return { reserva, booking };
    });

    expect(resultado.reserva.status).toBe("confirmed");
    expect(resultado.booking.status).toBe("confirmed");
    expect(resultado.booking.confirmed_at).not.toBeNull();
  });

  /**
   * O coração da invariante 6. Se o booking não puder existir, o gasto não pode
   * sobreviver — senão a ficha desaparece sem sessão nenhuma.
   */
  it("gasto não sobrevive a booking que falha", async () => {
    const resultado = await emRollback(async (tx) => {
      const base = await cenario(tx);
      const mesmoId = crypto.randomUUID();

      await reservaNaTransacao(tx, pedido(base, { bookingId: mesmoId }));

      /**
       * O mesmo id de novo, num horário **livre** — 10h, que o descanso da
       * sessão das 9h não alcança. Se o horário fosse 9h30 o motor recusaria
       * antes, e o teste mediria o descanso em vez da chave de idempotência.
       */
      const erro = await esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, pedido(base, { bookingId: mesmoId, inicio: TERCA_10H })),
      );

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${base.professionalId}`;
      const [gastos] = await tx<{ n: number }[]>`
        select count(*)::int as n from wallet_ledger
         where user_id = ${base.professionalId} and type = 'spend'`;
      const [sessoes] = await tx<{ n: number }[]>`
        select count(*)::int as n from bookings where professional_id = ${base.professionalId}`;

      return { erro, saldo: carteira.balance, gastos: gastos.n, sessoes: sessoes.n };
    });

    expect(ehChaveRepetida(resultado.erro)).toBe(true);
    // Só a primeira reserva sobreviveu: uma ficha gasta, uma sessão.
    expect(resultado.saldo).toBe(1);
    expect(resultado.gastos).toBe(1);
    expect(resultado.sessoes).toBe(1);
  });

  it("carteira sem ficha derruba tudo — o check decide, não o código", async () => {
    const resultado = await emRollback(async (tx) => {
      const base = await cenario(tx, { naCarteira: 0 });

      const erro = await esperandoFalha(tx, (sp) => reservaNaTransacao(sp, pedido(base)));

      const [sessoes] = await tx<{ n: number }[]>`
        select count(*)::int as n from bookings where professional_id = ${base.professionalId}`;
      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${base.professionalId}`;

      return { erro, sessoes: sessoes.n, saldo: carteira.balance };
    });

    expect(ehSaldoNegativo(resultado.erro)).toBe(true);
    expect(resultado.sessoes).toBe(0);
    expect(resultado.saldo).toBe(0);
  });
});

run("reserva — invariante 14 na escrita", () => {
  it("recusa horário que não está na grade do Parceiro", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx);
      // 9h15 não é começo de slot: o passo é de 30 minutos.
      return esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, pedido(base, { inicio: new Date("2026-09-29T12:15:00Z") })),
      );
    });

    expect(erro).toBeInstanceOf(HorarioIndisponivel);
    expect((erro as Error).message).toContain("não está na agenda");
  });

  it("recusa dia em que o Parceiro não atende", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx);
      // Quarta-feira: a rotina é só terça.
      return esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, pedido(base, { inicio: new Date("2026-09-30T12:00:00Z") })),
      );
    });

    expect(erro).toBeInstanceOf(HorarioIndisponivel);
  });

  /**
   * O horário existe na rotina e ainda assim é recusado — o motivo do motor
   * chega à mensagem. É o que impede um `curl` de contornar o aviso mínimo que a
   * tela respeita.
   */
  it("recusa horário dentro do aviso mínimo, com o motivo", async () => {
    const erro = await emRollback(async (tx) => {
      const ator = await operadora(tx);
      const orgId = await empresa(tx, ator);
      const professionalId = await profissional(tx, orgId, ator);
      // Sexta 9h às 12h: hoje é sexta 9h, então a manhã toda está no aviso mínimo.
      const partnerId = await parceiroComRotina(tx, ator, {
        regras: [{ diaDaSemana: 5, inicioMin: 540, fimMin: 720 }],
      });
      await darFichas(tx, { orgId, userId: professionalId, ator, contrato: 10, naCarteira: 2 });

      return esperandoFalha(tx, (sp) =>
        reservaNaTransacao(
          sp,
          pedido(
            { orgId, partnerId, professionalId },
            { inicio: new Date("2026-09-25T13:00:00Z") },
          ),
        ),
      );
    });

    expect(erro).toBeInstanceOf(HorarioIndisponivel);
    expect((erro as Error).message).toContain("perto demais");
  });

  it("recusa horário que outra pessoa já tomou", async () => {
    const resultado = await emRollback(async (tx) => {
      const base = await cenario(tx);
      const outro = await profissional(tx, base.orgId, base.ator, "Outra Pessoa");
      await darFichas(tx, {
        orgId: base.orgId,
        userId: outro,
        ator: base.ator,
        contrato: 10,
        naCarteira: 2,
      });

      await reservaNaTransacao(tx, pedido(base));

      const erro = await esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, pedido({ ...base, professionalId: outro })),
      );

      const [carteira] = await tx<{ balance: number }[]>`
        select balance from wallets where user_id = ${outro}`;
      return { erro, saldoDoOutro: carteira.balance };
    });

    // O motor vê a ocupação e recusa antes de chegar à constraint.
    expect(resultado.erro).toBeInstanceOf(HorarioIndisponivel);
    expect((resultado.erro as Error).message).toContain("tomado");
    // E a ficha de quem não conseguiu não foi tocada.
    expect(resultado.saldoDoOutro).toBe(2);
  });

  it("respeita o descanso do Parceiro entre sessões", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx);
      await reservaNaTransacao(tx, pedido(base));
      // 9h30 começa no instante em que a de 9h termina; o buffer é de 15 min.
      return esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, pedido(base, { inicio: TERCA_9H30 })),
      );
    });

    expect(erro).toBeInstanceOf(HorarioIndisponivel);
    expect((erro as Error).message).toContain("colado");
  });
});

run("reserva — quem pode reservar", () => {
  it("recusa Parceiro que não está ativo", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx, { status: "paused" });
      return esperandoFalha(tx, (sp) => reservaNaTransacao(sp, pedido(base)));
    });

    expect(erro).toBeInstanceOf(ParceiroIndisponivel);
  });

  it("recusa carteira de outra empresa (invariante 13)", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx);
      const outraEmpresa = await empresa(tx, base.ator, "Outra Empresa");
      return esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, { ...pedido(base), orgId: outraEmpresa }),
      );
    });

    expect(erro).toBeInstanceOf(ProfissionalInvalido);
    expect((erro as Error).message).toContain("outra empresa");
  });

  it("recusa Profissional com acesso desativado", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx);
      await tx`update profiles set active = false where id = ${base.professionalId}`;
      return esperandoFalha(tx, (sp) => reservaNaTransacao(sp, pedido(base)));
    });

    expect(erro).toBeInstanceOf(ProfissionalInvalido);
    expect((erro as Error).message).toContain("inativo");
  });

  it("recusa quando há pedidos pendentes demais", async () => {
    const erro = await emRollback(async (tx) => {
      const base = await cenario(tx, { naCarteira: 3 });
      await reservaNaTransacao(tx, pedido(base, { maxPendentes: 1 }));
      return esperandoFalha(tx, (sp) =>
        reservaNaTransacao(sp, pedido(base, { inicio: TERCA_9H30, maxPendentes: 1 })),
      );
    });

    expect(erro).toBeInstanceOf(LimiteDePendentes);
  });

  /** Confirmada não conta como pendente — o teto é de pedido sem resposta. */
  it("sessão confirmada não ocupa vaga no teto de pendentes", async () => {
    const segunda = await emRollback(async (tx) => {
      const base = await cenario(tx, { naCarteira: 3, autoConfirm: true });
      await reservaNaTransacao(tx, pedido(base, { maxPendentes: 1 }));
      return reservaNaTransacao(
        tx,
        pedido(base, { inicio: TERCA_10H, maxPendentes: 1 }),
      );
    });

    expect(segunda.status).toBe("confirmed");
  });
});

describe("tradução da sobreposição", () => {
  /**
   * A constraint de exclusão em si já é testada em `db/invariantes.test.ts`. O que
   * falta provar é que o código a reconhece: na corrida real, duas reservas
   * simultâneas chegam depois de as duas passarem pelo motor, e quem perde tem de
   * ler uma frase.
   */
  it("`23P01` vira HorarioIndisponivel, não erro cru", async () => {
    const violacao = Object.assign(new Error("conflicting key value"), { code: "23P01" });
    expect(ehSobreposicao(violacao)).toBe(true);

    await expect(
      comTraducao(
        () => Promise.reject(violacao),
        "sem saldo",
        "Esse horário acabou de ser tomado. Escolha outro.",
      ),
    ).rejects.toBeInstanceOf(HorarioIndisponivel);
  });

  it("outro código de erro continua subindo", async () => {
    const outro = Object.assign(new Error("deu ruim"), { code: "42P01" });
    await expect(comTraducao(() => Promise.reject(outro), "sem saldo")).rejects.toThrow("deu ruim");
  });
});
