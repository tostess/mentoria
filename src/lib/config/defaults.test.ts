import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_CONFIG } from './defaults';

/**
 * Trava a semente contra a tabela de economia do CLAUDE.md. Se um numero mudar
 * aqui sem mudar la (ou vice-versa), o teste quebra e a conversa acontece.
 */
describe('DEFAULT_APP_CONFIG.coinPolicy', () => {
  const p = DEFAULT_APP_CONFIG.coinPolicy;

  it('da 3 de boas-vindas e 3 por mes, com teto de 8', () => {
    expect(p.welcomeGrant).toBe(3);
    expect(p.monthlyGrant).toBe(3);
    expect(p.monthlyGrantDay).toBe(1);
    expect(p.balanceCap).toBe(8);
  });

  it('expira em 90 dias consumindo FIFO', () => {
    expect(p.expiryDays).toBe(90);
    expect(p.consumptionOrder).toBe('fifo');
  });

  it('cobra 1 por 30 min, 2 por 45 min, 1 por pergunta assincrona', () => {
    expect(p.priceByDurationMin['30']).toBe(1);
    expect(p.priceByDurationMin['45']).toBe(2);
    expect(p.asyncQuestionPrice).toBe(1);
    expect(p.pillPrice).toBe(0);
    expect(p.reschedulePrice).toBe(0);
  });

  it('estorna cancelamento com mais de 12h e compensa ausencia do mentor', () => {
    expect(p.cancellation.freeCancelHoursBefore).toBe(12);
    expect(p.cancellation.menteeNoShowRefund).toBe('none');
    expect(p.cancellation.mentorNoShowRefund).toBe('full');
    expect(p.cancellation.mentorNoShowCompensation).toBe(1);
  });

  it('presente vale 1, exige avaliacao e tem cota mensal de 3 que nao acumula', () => {
    expect(p.gift.amount).toBe(1);
    expect(p.gift.quotaMonthly).toBe(3);
    expect(p.gift.quotaAccumulates).toBe(false);
    expect(p.gift.requiresReview).toBe(true);
  });

  it('mantem desligados os interruptores ainda em aberto', () => {
    expect(p.mentorEarnsCoinPerDonatedHour).toBe(false);
    expect(p.menteeEarnsCoinForContributing).toBe(false);
  });
});

describe('DEFAULT_APP_CONFIG', () => {
  it('nasce na org publica (invariante 9)', () => {
    expect(DEFAULT_APP_CONFIG.orgId).toBe('public');
  });

  it('usa cores em hex, nunca CSS variables', () => {
    for (const [key, value] of Object.entries(DEFAULT_APP_CONFIG.branding)) {
      if (typeof value !== 'string' || key === 'productName' || key === 'logoUrl') continue;
      expect(value, key).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
