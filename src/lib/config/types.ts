/**
 * Tipos de `appConfig/{orgId}`.
 *
 * INVARIANTE 8: taxonomia e textos vivem no Firestore, nunca hardcoded. O que
 * esta em `defaults.ts` e semente do documento, nao fonte de verdade em runtime.
 */

export interface Branding {
  /** Cores sempre em hex (CLAUDE.md: nunca CSS variables). */
  primary: string;
  primaryContrast: string;
  accent: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  logoUrl: string | null;
  productName: string;
}

export interface TaxonomyArea {
  id: string;
  label: string;
  skills: string[];
}

export interface Taxonomy {
  areas: TaxonomyArea[];
  seniorities: string[];
  reviewTags: string[];
}

export interface Copy {
  /** Nome da moeda na interface — em aberto no CLAUDE.md, default "moeda". */
  coinName: string;
  coinNamePlural: string;
  tagline: string;
  emptyStateMentors: string;
  briefingPrompt: string;
  giftPrompt: string;
}

export interface CoinPolicy {
  /** Boas-vindas: +3 */
  welcomeGrant: number;
  /** Credito mensal no dia 1: +3 */
  monthlyGrant: number;
  monthlyGrantDay: number;
  /** Teto de acumulo: 8 */
  balanceCap: number;
  /** Validade em dias: 90 */
  expiryDays: number;
  /** Consumo FIFO — mais antiga primeiro. */
  consumptionOrder: 'fifo';
  /** Preco por duracao de sessao em minutos: 30 -> 1, 45 -> 2 */
  priceByDurationMin: Record<string, number>;
  asyncQuestionPrice: number;
  pillPrice: number;
  reschedulePrice: number;
  cancellation: {
    /** Cancelamento com mais de 12h de antecedencia: estorno total. */
    freeCancelHoursBefore: number;
    /** Mentorado ausente: moeda consumida. */
    menteeNoShowRefund: 'none' | 'full';
    /** Mentor ausente: estorno total... */
    mentorNoShowRefund: 'none' | 'full';
    /** ...+1 de compensacao. */
    mentorNoShowCompensation: number;
  };
  gift: {
    enabled: boolean;
    /** +1 ao mentorado, -1 da cota. */
    amount: number;
    /** Cota mensal do mentor: 3, nao acumula. */
    quotaMonthly: number;
    quotaAccumulates: boolean;
    /** Presente exige avaliacao preenchida. */
    requiresReview: boolean;
  };
  /** Em aberto no CLAUDE.md — interruptor previsto, desligado por padrao. */
  mentorEarnsCoinPerDonatedHour: boolean;
  menteeEarnsCoinForContributing: boolean;
}

export interface Flags {
  groupFormat: boolean;
  asyncQuestions: boolean;
  pills: boolean;
  tracks: boolean;
  aiMatching: boolean;
  whatsappCheckins: boolean;
  sponsorConsole: boolean;
  spontaneousApplications: boolean;
}

export interface AppConfig {
  orgId: string;
  branding: Branding;
  taxonomy: Taxonomy;
  copy: Copy;
  coinPolicy: CoinPolicy;
  flags: Flags;
  version: number;
  publishedBy: string | null;
  publishedAt: string | null;
}
