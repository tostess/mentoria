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
import { acessoDaTransacao } from "@/lib/ledger/mensal";
import { chaveEstorno } from "@/lib/ledger/keys";
import type { Limites } from "@/lib/scheduling";
import type { EntradaNaSala } from "@/lib/video/presenca";
import { reservaNaTransacao } from "./operacoes";
import {
  CorrecaoRecusada,
  MOTIVO_COMPENSACAO,
  MOTIVO_EXPIRACAO,
  MOTIVO_RECUSA,
  MOTIVO_SEM_ATENDIMENTO,
  PedidoJaRespondido,
  SessaoNaoEncontrada,
  confirmacaoNaTransacao,
  correcaoDePresencaNaTransacao,
  expiracaoNaTransacao,
  expirarPendentesNaConexao,
  fechamentoNaTransacao,
  fecharSessoesNaConexao,
  recusaNaTransacao,
} from "./transicoes";

/**
 * As transições da P4 contra o Postgres de verdade.
 *
 * Mesmo relógio de `reserva.test.ts`: o pedido é feito na sexta
 * **2026-09-25T12:00:00Z** (9h em São Paulo) para terça 29/09 às 9h locais =
 * **12:00Z**. `created_at` nasce do relógio real do banco, então os testes de
 * expiração o reescrevem — `bookings` não é livro-caixa e aceita `update`.
 *
 * As rodadas dos crons enxergam o banco inteiro, inclusive sessões de
 * demonstração do `mentoria-dev`. Por isso as asserções olham a sessão do teste
 * pelo id, nunca a contagem total.
 */

const url = process.env.DIRECT_URL;
const db = url ? postgres(url, { max: 1, connect_timeout: 15 }) : null;

afterAll(async () => {
  await db?.end({ timeout: 5 });
});

const run = db ? describe : describe.skip;
const emRollback = <T,>(fn: (tx: postgres.TransactionSql) => Promise<T>) => inRollback(db!, fn);

const PEDIDO_EM = new Date("2026-09-25T12:00:00Z");
const TERCA_9H = new Date("2026-09-29T12:00:00Z");
const TERCA_9H30 = new Date("2026-09-29T12:30:00Z");
const HORA = 3_600_000;
const MINUTO = 60_000;

const LIMITES: Limites = { horizonteDias: 14, avisoMinimoHoras: 12, duracaoMin: 30, passoMin: 30 };

async function cenario(tx: postgres.TransactionSql, opcoes: { autoConfirm?: boolean } = {}) {
  const ator = await operadora(tx);
  const orgId = await empresa(tx, ator);
  const professionalId = await profissional(tx, orgId, ator);
  const partnerId = await parceiroComRotina(tx, ator, {
    regras: [{ diaDaSemana: 2, inicioMin: 540, fimMin: 720 }],
    autoConfirm: opcoes.autoConfirm,
  });
  await darFichas(tx, { orgId, userId: professionalId, ator, contrato: 10, naCarteira: 2 });

  const reservar = (inicio = TERCA_9H, quem = professionalId) =>
    reservaNaTransacao(tx, {
      bookingId: crypto.randomUUID(),
      orgId,
      partnerId,
      professionalId: quem,
      inicio,
      agora: PEDIDO_EM,
      limites: LIMITES,
      precoFichas: 1,
      maxPendentes: 2,
    });

  const { bookingId } = await reservar();
  return { ator, orgId, professionalId, partnerId, bookingId, reservar };
}

async function estado(tx: postgres.TransactionSql, bookingId: string, professionalId: string) {
  const [sessao] = await tx<
    { status: string; cancelled_by: string | null; confirmed_at: string | null }[]
  >`select status::text, cancelled_by, confirmed_at from bookings where id = ${bookingId}`;
  const [carteira] = await tx<{ balance: number }[]>`
    select balance from wallets where user_id = ${professionalId}`;
  const estornos = await tx<{ reason: string; by_user_id: string | null }[]>`
    select reason, by_user_id from wallet_ledger where booking_id = ${bookingId} and type = 'refund'`;
  return { ...sessao, saldo: carteira.balance, estornos };
}

function falha<T>(tx: postgres.TransactionSql, fn: (sp: postgres.TransactionSql) => Promise<T>) {
  return tx
    .savepoint(async (sp) => {
      await fn(sp);
      return null;
    })
    .then(() => null)
    .catch((erro: unknown) => erro);
}

run("confirmar", () => {
  it("pending vira confirmed, com a hora da confirmação", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await confirmacaoNaTransacao(tx, {
        bookingId: s.bookingId,
        partnerId: s.partnerId,
        agora: PEDIDO_EM,
      });
      return estado(tx, s.bookingId, s.professionalId);
    });

    expect(r.status).toBe("confirmed");
    expect(new Date(r.confirmed_at!).toISOString()).toBe(PEDIDO_EM.toISOString());
    expect(r.saldo).toBe(1);
  });

  it("sessão de outro Parceiro responde como se não existisse", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const outro = await parceiroComRotina(tx, s.ator);
      const erro = await falha(tx, (sp) =>
        confirmacaoNaTransacao(sp, { bookingId: s.bookingId, partnerId: outro, agora: PEDIDO_EM }),
      );
      return { erro, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.erro).toBeInstanceOf(SessaoNaoEncontrada);
    expect(r.status).toBe("pending");
  });

  it("recusa confirmar depois que o horário passou", async () => {
    const erro = await emRollback(async (tx) => {
      const s = await cenario(tx);
      return falha(tx, (sp) =>
        confirmacaoNaTransacao(sp, {
          bookingId: s.bookingId,
          partnerId: s.partnerId,
          agora: TERCA_9H,
        }),
      );
    });

    expect(erro).toBeInstanceOf(PedidoJaRespondido);
    expect((erro as Error).message).toMatch(/já passou/);
  });
});

run("recusar", () => {
  it("cancela, registra quem recusou e devolve a ficha na mesma transação", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const retorno = await recusaNaTransacao(tx, {
        bookingId: s.bookingId,
        partnerId: s.partnerId,
        agora: PEDIDO_EM,
      });
      return { s, retorno, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.status).toBe("cancelled");
    expect(r.cancelled_by).toBe(r.s.partnerId);
    expect(r.retorno.saldoCarteira).toBe(2);
    expect(r.saldo).toBe(2);
    expect(r.estornos).toEqual([{ reason: MOTIVO_RECUSA, by_user_id: r.s.partnerId }]);
  });

  it("libera o horário: outra pessoa consegue marcar o mesmo instante", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await recusaNaTransacao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: PEDIDO_EM });

      const outra = await profissional(tx, s.orgId, s.ator, "Outra Pessoa");
      await darFichas(tx, { orgId: s.orgId, userId: outra, ator: s.ator, contrato: 5, naCarteira: 1 });
      return s.reservar(TERCA_9H, outra);
    });

    expect(r.inicio.toISOString()).toBe(TERCA_9H.toISOString());
  });

  it("não recusa o que já foi confirmado", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await confirmacaoNaTransacao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: PEDIDO_EM });
      const erro = await falha(tx, (sp) =>
        recusaNaTransacao(sp, { bookingId: s.bookingId, partnerId: s.partnerId, agora: PEDIDO_EM }),
      );
      return { erro, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.erro).toBeInstanceOf(PedidoJaRespondido);
    expect(r.status).toBe("confirmed");
    expect(r.estornos).toHaveLength(0);
  });
});

run("expirar — expire-pending", () => {
  it("expira depois de pending_expires_hours e devolve a ficha", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await tx`update bookings set created_at = ${PEDIDO_EM.toISOString()}::timestamptz where id = ${s.bookingId}`;

      const cedo = await expiracaoNaTransacao(tx, s.bookingId, {
        agora: new Date(PEDIDO_EM.getTime() + 47 * HORA),
        horasParaExpirar: 48,
      });
      const naHora = await expiracaoNaTransacao(tx, s.bookingId, {
        agora: new Date(PEDIDO_EM.getTime() + 48 * HORA),
        horasParaExpirar: 48,
      });
      return { cedo, naHora, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.cedo).toBe(false);
    expect(r.naHora).toBe(true);
    expect(r.status).toBe("expired");
    expect(r.saldo).toBe(2);
    expect(r.estornos).toEqual([{ reason: MOTIVO_EXPIRACAO, by_user_id: null }]);
  });

  it("expira quando o horário chega, mesmo dentro do prazo", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      // Pedido feito 12 h antes da sessão: quando ela começa, o prazo de 48 h nem passou da metade.
      await tx`update bookings set created_at = ${new Date(TERCA_9H.getTime() - 12 * HORA).toISOString()}::timestamptz
                where id = ${s.bookingId}`;

      const antes = await expiracaoNaTransacao(tx, s.bookingId, {
        agora: new Date(TERCA_9H.getTime() - MINUTO),
        horasParaExpirar: 48,
      });
      const naHora = await expiracaoNaTransacao(tx, s.bookingId, {
        agora: TERCA_9H,
        horasParaExpirar: 48,
      });
      return { antes, naHora, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.antes).toBe(false);
    expect(r.naHora).toBe(true);
    expect(r.status).toBe("expired");
  });

  it("recusa e expiração no mesmo minuto produzem um estorno só", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await tx`update bookings set created_at = ${PEDIDO_EM.toISOString()}::timestamptz where id = ${s.bookingId}`;
      const agora = new Date(PEDIDO_EM.getTime() + 48 * HORA);

      await recusaNaTransacao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora });
      const cronExpirou = await expiracaoNaTransacao(tx, s.bookingId, { agora, horasParaExpirar: 48 });

      return { cronExpirou, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.cronExpirou).toBe(false);
    expect(r.status).toBe("cancelled");
    expect(r.estornos).toHaveLength(1);
    expect(r.saldo).toBe(2);
  });

  it("depois de expirado, o Parceiro lê que a ficha já voltou", async () => {
    const erro = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await tx`update bookings set created_at = ${PEDIDO_EM.toISOString()}::timestamptz where id = ${s.bookingId}`;
      const agora = new Date(PEDIDO_EM.getTime() + 48 * HORA);
      await expiracaoNaTransacao(tx, s.bookingId, { agora, horasParaExpirar: 48 });
      return falha(tx, (sp) =>
        recusaNaTransacao(sp, { bookingId: s.bookingId, partnerId: s.partnerId, agora }),
      );
    });

    expect(erro).toBeInstanceOf(PedidoJaRespondido);
    expect((erro as Error).message).toMatch(/expirou/);
  });

  it("a rodada expira o pedido vencido, uma transação por sessão, e não repete", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      await tx`update bookings set created_at = ${PEDIDO_EM.toISOString()}::timestamptz where id = ${s.bookingId}`;
      const regra = { agora: new Date(PEDIDO_EM.getTime() + 48 * HORA), horasParaExpirar: 48 };

      const primeira = await expirarPendentesNaConexao(acessoDaTransacao(tx), regra);
      const segunda = await expirarPendentesNaConexao(acessoDaTransacao(tx), regra);
      const [refund] = await tx<{ n: number }[]>`
        select count(*)::int as n from wallet_ledger where idempotency_key = ${chaveEstorno(s.bookingId)}`;

      return { s, primeira, segunda, refunds: refund.n, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.status).toBe("expired");
    expect(r.primeira.feitas).toBeGreaterThanOrEqual(1);
    expect(r.primeira.erros.filter((e) => e.startsWith(r.s.bookingId))).toEqual([]);
    // A segunda rodada nem lista o que já expirou.
    expect(r.segunda.erros.filter((e) => e.startsWith(r.s.bookingId))).toEqual([]);
    expect(r.refunds).toBe(1);
  });
});

const FECHAMENTO = {
  agora: new Date(TERCA_9H30.getTime() + 15 * MINUTO),
  toleranciaMin: 15,
  compensacao: 1,
};

/** Uma entrada na sala, em minutos a partir das 9h da terça. */
function entrada(userId: string, deMin: number, ateMin: number): EntradaNaSala {
  return {
    userId,
    participantId: crypto.randomUUID(),
    reuniaoId: "reuniao-de-teste",
    entrou: new Date(TERCA_9H.getTime() + deMin * MINUTO),
    saiu: new Date(TERCA_9H.getTime() + ateMin * MINUTO),
  };
}

async function fechamento(tx: postgres.TransactionSql, bookingId: string) {
  const [b] = await tx<
    { attended_partner: boolean | null; attended_professional: boolean | null }[]
  >`select attended_partner, attended_professional from bookings where id = ${bookingId}`;
  const eventos = await tx<{ kind: string; user_id: string | null }[]>`
    select kind, user_id from session_events where booking_id = ${bookingId} order by at, kind`;
  const extras = await tx<{ type: string; amount: number; reason: string }[]>`
    select type::text, amount, reason from wallet_ledger
     where booking_id = ${bookingId} and type in ('refund', 'adjust') order by type`;
  return { ...b, eventos, extras };
}

run("fechar — close-sessions sem sala (regra da P4)", () => {
  it("confirmada vira done quando passa o fim + tolerância, e conta para o Parceiro", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });

      const cedo = await fechamentoNaTransacao(
        tx,
        s.bookingId,
        { ...FECHAMENTO, agora: new Date(TERCA_9H30.getTime() + 14 * MINUTO) },
        null,
      );
      const naHora = await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, null);
      const [parceiro] = await tx<{ session_count: number }[]>`
        select session_count from partners where id = ${s.partnerId}`;
      return { cedo, naHora, sessoes: parceiro.session_count, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.cedo).toBe(false);
    expect(r.naHora).toBe(true);
    expect(r.status).toBe("done");
    expect(r.sessoes).toBe(1);
    // Sessão realizada não devolve ficha.
    expect(r.estornos).toHaveLength(0);
    expect(r.saldo).toBe(1);
  });

  it("não fecha pedido pendente — esse é caminho do expire-pending", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx);
      const fechou = await fechamentoNaTransacao(
        tx,
        s.bookingId,
        { ...FECHAMENTO, agora: new Date(TERCA_9H30.getTime() + HORA) },
        null,
      );
      return { fechou, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.fechou).toBe(false);
    expect(r.status).toBe("pending");
  });

  it("a rodada sem leitor de presença fecha a sessão do teste como done", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      const rodada = await fecharSessoesNaConexao(acessoDaTransacao(tx), FECHAMENTO, null);
      return { s, rodada, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.status).toBe("done");
    expect(r.rodada.erros.filter((e) => e.startsWith(r.s.bookingId))).toEqual([]);
  });
});

run("fechar — presença lida da sala (invariante 18)", () => {
  it("os dois entraram: done, presença gravada e cada entrada em session_events", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [
        entrada(s.partnerId, -3, 31),
        entrada(s.professionalId, 1, 30),
      ]);
      const [parceiro] = await tx<{ session_count: number }[]>`
        select session_count from partners where id = ${s.partnerId}`;
      return {
        s,
        sessoes: parceiro.session_count,
        ...(await estado(tx, s.bookingId, s.professionalId)),
        ...(await fechamento(tx, s.bookingId)),
      };
    });

    expect(r.status).toBe("done");
    expect(r.attended_partner).toBe(true);
    expect(r.attended_professional).toBe(true);
    expect(r.sessoes).toBe(1);
    expect(r.saldo).toBe(1);
    expect(r.extras).toEqual([]);
    expect(r.eventos).toEqual([
      { kind: "participant.joined", user_id: r.s.partnerId },
      { kind: "participant.joined", user_id: r.s.professionalId },
      { kind: "participant.left", user_id: r.s.professionalId },
      { kind: "participant.left", user_id: r.s.partnerId },
    ]);
  });

  it("só o Profissional entrou: no_show_partner, a ficha volta e vem a compensação", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [entrada(s.professionalId, 0, 20)]);
      const [parceiro] = await tx<{ session_count: number }[]>`
        select session_count from partners where id = ${s.partnerId}`;
      return {
        sessoes: parceiro.session_count,
        ...(await estado(tx, s.bookingId, s.professionalId)),
        ...(await fechamento(tx, s.bookingId)),
      };
    });

    expect(r.status).toBe("no_show_partner");
    expect(r.attended_partner).toBe(false);
    expect(r.attended_professional).toBe(true);
    expect(r.sessoes).toBe(0);
    // 2 alocadas − 1 gasta + 1 estorno + 1 compensação.
    expect(r.saldo).toBe(3);
    expect(r.extras).toEqual([
      { type: "adjust", amount: 1, reason: MOTIVO_COMPENSACAO },
      { type: "refund", amount: 1, reason: MOTIVO_SEM_ATENDIMENTO },
    ]);
  });

  it("compensação zerada em app_config estorna sem lançar ajuste", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, { ...FECHAMENTO, compensacao: 0 }, [
        entrada(s.professionalId, 0, 20),
      ]);
      return { ...(await estado(tx, s.bookingId, s.professionalId)), ...(await fechamento(tx, s.bookingId)) };
    });

    expect(r.status).toBe("no_show_partner");
    expect(r.saldo).toBe(2);
    expect(r.extras.map((e) => e.type)).toEqual(["refund"]);
  });

  it("só o Parceiro entrou: no_show_professional, e a ficha foi usada", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [entrada(s.partnerId, -5, 30)]);
      return { ...(await estado(tx, s.bookingId, s.professionalId)), ...(await fechamento(tx, s.bookingId)) };
    });

    expect(r.status).toBe("no_show_professional");
    expect(r.attended_partner).toBe(true);
    expect(r.attended_professional).toBe(false);
    expect(r.saldo).toBe(1);
    expect(r.extras).toEqual([]);
  });

  it("testar a câmera antes do horário e sair não é comparecer", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [
        entrada(s.partnerId, -5, 30),
        entrada(s.professionalId, -9, -4),
      ]);
      return estado(tx, s.bookingId, s.professionalId);
    });

    expect(r.status).toBe("no_show_professional");
  });

  it("a rodada não pergunta à sala por sessão que nunca emitiu token: ninguém entrou", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      const perguntadas: string[] = [];
      const rodada = await fecharSessoesNaConexao(acessoDaTransacao(tx), FECHAMENTO, async (sala) => {
        perguntadas.push(sala);
        return [];
      });
      return { s, rodada, perguntadas, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.status).toBe("no_show_professional");
    expect(r.perguntadas).not.toContain(r.s.bookingId);
  });

  it("Daily fora do ar não fecha: a sessão fica para a próxima rodada", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await tx`update bookings set room_name = ${s.bookingId} where id = ${s.bookingId}`;
      const rodada = await fecharSessoesNaConexao(acessoDaTransacao(tx), FECHAMENTO, async (sala) => {
        if (sala === s.bookingId) throw new Error("Daily 503");
        return [];
      });
      return { s, rodada, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.status).toBe("confirmed");
    expect(r.rodada.erros).toContain(`${r.s.bookingId}: Daily 503`);
  });

  it("a correção de presença passa a sessão para done, conta para o Parceiro e audita", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [entrada(s.partnerId, -2, 30)]);
      const saldoAntes = (await estado(tx, s.bookingId, s.professionalId)).saldo;

      await correcaoDePresencaNaTransacao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: FECHAMENTO.agora });

      const [parceiro] = await tx<{ session_count: number }[]>`
        select session_count from partners where id = ${s.partnerId}`;
      const auditoria = await tx<
        { action: string; actor_id: string; actor_role: string; entity_id: string; org_id: string; after: unknown }[]
      >`select action, actor_id, actor_role::text, entity_id, org_id, after from audit_logs
         where action = 'corrigir_presenca' and actor_id = ${s.partnerId}`;
      return {
        s,
        saldoAntes,
        sessoes: parceiro.session_count,
        auditoria,
        ...(await estado(tx, s.bookingId, s.professionalId)),
        ...(await fechamento(tx, s.bookingId)),
      };
    });

    expect(r.status).toBe("done");
    expect(r.attended_professional).toBe(true);
    expect(r.sessoes).toBe(1);
    // A ficha já tinha sido usada: corrigir não move dinheiro.
    expect(r.saldo).toBe(r.saldoAntes);
    expect(r.auditoria).toEqual([
      {
        action: "corrigir_presenca",
        actor_id: r.s.partnerId,
        actor_role: "partner",
        entity_id: r.s.professionalId,
        org_id: r.s.orgId,
        after: { sessao: r.s.bookingId, status: "done", presenca_profissional: true, presenca_parceiro: true },
      },
    ]);
  });

  it("a sala que perdeu os dois: corrigir marca as duas presenças", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, []);
      await correcaoDePresencaNaTransacao(tx, { bookingId: s.bookingId, partnerId: s.partnerId, agora: FECHAMENTO.agora });
      const [a] = await tx<{ before: unknown }[]>`
        select before from audit_logs where action = 'corrigir_presenca' and actor_id = ${s.partnerId}`;
      return { antes: a.before, ...(await fechamento(tx, s.bookingId)) };
    });

    expect(r.attended_partner).toBe(true);
    expect(r.attended_professional).toBe(true);
    expect(r.antes).toMatchObject({ presenca_profissional: false, presenca_parceiro: false });
  });

  it("a falta do próprio Parceiro não se corrige por aqui", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [entrada(s.professionalId, 0, 20)]);
      const erro = await falha(tx, (sp) =>
        correcaoDePresencaNaTransacao(sp, { bookingId: s.bookingId, partnerId: s.partnerId, agora: FECHAMENTO.agora }),
      );
      return { erro, ...(await estado(tx, s.bookingId, s.professionalId)) };
    });

    expect(r.erro).toBeInstanceOf(CorrecaoRecusada);
    expect(r.status).toBe("no_show_partner");
    expect(r.saldo).toBe(3);
  });

  it("sessão realizada e sessão de outro Parceiro são recusadas", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await fechamentoNaTransacao(tx, s.bookingId, FECHAMENTO, [
        entrada(s.partnerId, 0, 30),
        entrada(s.professionalId, 0, 30),
      ]);
      const outro = await parceiroComRotina(tx, s.ator);
      const jaFeita = await falha(tx, (sp) =>
        correcaoDePresencaNaTransacao(sp, { bookingId: s.bookingId, partnerId: s.partnerId, agora: FECHAMENTO.agora }),
      );
      const alheia = await falha(tx, (sp) =>
        correcaoDePresencaNaTransacao(sp, { bookingId: s.bookingId, partnerId: outro, agora: FECHAMENTO.agora }),
      );
      return { jaFeita, alheia };
    });

    expect(r.jaFeita).toBeInstanceOf(CorrecaoRecusada);
    expect((r.jaFeita as Error).message).toMatch(/já conta como realizada/);
    expect(r.alheia).toBeInstanceOf(SessaoNaoEncontrada);
  });

  it("duas rodadas seguidas estornam e compensam uma vez só", async () => {
    const r = await emRollback(async (tx) => {
      const s = await cenario(tx, { autoConfirm: true });
      await tx`update bookings set room_name = ${s.bookingId} where id = ${s.bookingId}`;
      const leitor = async (sala: string) =>
        sala === s.bookingId ? [entrada(s.professionalId, 0, 25)] : [];

      await fecharSessoesNaConexao(acessoDaTransacao(tx), FECHAMENTO, leitor);
      const segunda = await fecharSessoesNaConexao(acessoDaTransacao(tx), FECHAMENTO, leitor);
      return {
        s,
        segunda,
        ...(await estado(tx, s.bookingId, s.professionalId)),
        ...(await fechamento(tx, s.bookingId)),
      };
    });

    expect(r.status).toBe("no_show_partner");
    expect(r.extras).toHaveLength(2);
    expect(r.saldo).toBe(3);
    expect(r.segunda.erros.filter((e) => e.startsWith(r.s.bookingId))).toEqual([]);
  });
});
