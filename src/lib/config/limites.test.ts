import { describe, expect, it } from "vitest";
import { DEFAULT_APP_CONFIG, type AppConfig } from "./app-config";
import { DURACAO_DA_SESSAO_MIN, PASSO_DA_GRADE_MIN, limitesDoMotor } from "./limites";

/**
 * A tradução de `app_config.limits` para o `Limites` do motor.
 *
 * Existe teste para uma função de cinco linhas porque o que ela protege não é a
 * cópia dos campos — é que exista **uma** cópia. Antes disso a conta estava
 * escrita à mão na tela de disponibilidade, e a reserva ia precisar da mesma:
 * duas cópias divergindo produziriam uma tela oferecendo horário que o servidor
 * recusa, que é o pior jeito de a pessoa descobrir.
 */

function comLimites(ajustes: Partial<AppConfig["limits"]>): AppConfig {
  return { ...DEFAULT_APP_CONFIG, limits: { ...DEFAULT_APP_CONFIG.limits, ...ajustes } };
}

describe("limitesDoMotor", () => {
  it("leva os defaults do banco para os nomes do motor", () => {
    expect(limitesDoMotor(DEFAULT_APP_CONFIG)).toEqual({
      horizonteDias: 14,
      avisoMinimoHoras: 12,
      duracaoMin: 30,
      passoMin: 30,
    });
  });

  it("acompanha a configuração quando ela muda", () => {
    const limites = limitesDoMotor(comLimites({ bookingHorizonDays: 7, minNoticeHours: 2 }));
    expect(limites.horizonteDias).toBe(7);
    expect(limites.avisoMinimoHoras).toBe(2);
  });

  /**
   * Duração é constante, não configuração: "sessão de 30 minutos apenas no
   * lançamento" é decisão de produto, e `bookings.duration_min` tem o mesmo
   * default. Mexer em `limits` não pode mudá-la por acidente.
   */
  it("duração e passo não vêm de `limits`", () => {
    const limites = limitesDoMotor(comLimites({ sessionGraceMinutes: 99 }));
    expect(limites.duracaoMin).toBe(DURACAO_DA_SESSAO_MIN);
    expect(limites.passoMin).toBe(PASSO_DA_GRADE_MIN);
  });

  it("o passo é igual à duração — o descanso é imposto pelo buffer, não pela grade", () => {
    expect(PASSO_DA_GRADE_MIN).toBe(DURACAO_DA_SESSAO_MIN);
  });

  it("não inventa campo além dos quatro que o motor conhece", () => {
    expect(Object.keys(limitesDoMotor(DEFAULT_APP_CONFIG)).sort()).toEqual([
      "avisoMinimoHoras",
      "duracaoMin",
      "horizonteDias",
      "passoMin",
    ]);
  });
});
