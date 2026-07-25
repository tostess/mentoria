// Import relativo de proposito: este modulo tambem e carregado pelo script de
// seed, fora do resolvedor de paths do Next.
import { DEFAULT_ORG_ID } from '../auth/roles';
import type { AppConfig } from './types';

/**
 * Semente de `appConfig/public`. Reproduz a tabela de economia do CLAUDE.md.
 *
 * Estes numeros sao o DEFAULT, nao o codigo: em runtime, sempre ler
 * `appConfig/{orgId}` do Firestore. Nada aqui deve ser importado por regra de
 * negocio — apenas pelo seed e pelo fallback de renderizacao inicial.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  orgId: DEFAULT_ORG_ID,

  branding: {
    primary: '#4F46E5',
    primaryContrast: '#FFFFFF',
    accent: '#F59E0B',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#64748B',
    border: '#E2E8F0',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    logoUrl: null,
    productName: 'Mentoria',
  },

  taxonomy: {
    areas: [
      {
        id: 'produto',
        label: 'Produto',
        skills: ['Descoberta', 'Roadmap', 'Metricas', 'Priorizacao'],
      },
      {
        id: 'engenharia',
        label: 'Engenharia',
        skills: ['Arquitetura', 'Backend', 'Frontend', 'Dados', 'Carreira tecnica'],
      },
      {
        id: 'design',
        label: 'Design',
        skills: ['Pesquisa', 'Interface', 'Design system', 'Portfolio'],
      },
      {
        id: 'lideranca',
        label: 'Lideranca',
        skills: ['Primeira gestao', 'Feedback', 'Contratacao', 'Performance'],
      },
      {
        id: 'carreira',
        label: 'Carreira',
        skills: ['Transicao', 'Entrevista', 'Negociacao', 'Marca pessoal'],
      },
    ],
    seniorities: ['junior', 'pleno', 'senior', 'staff', 'gestao', 'executivo'],
    reviewTags: [
      'ouviu de verdade',
      'trouxe exemplos praticos',
      'ajudou a priorizar',
      'indicou material util',
      'foi direto ao ponto',
    ],
  },

  copy: {
    coinName: 'moeda',
    coinNamePlural: 'moedas',
    tagline: 'Converse com quem ja passou por isso.',
    emptyStateMentors: 'Nenhum mentor disponivel com esses filtros por enquanto.',
    briefingPrompt: 'O que voce quer resolver nesta sessao?',
    giftPrompt: 'Quer presentear uma moeda extra para esta pessoa?',
  },

  // ---- Tabela de economia (CLAUDE.md) ----
  coinPolicy: {
    welcomeGrant: 3,
    monthlyGrant: 3,
    monthlyGrantDay: 1,
    balanceCap: 8,
    expiryDays: 90,
    consumptionOrder: 'fifo',
    priceByDurationMin: {
      '30': 1,
      '45': 2,
    },
    asyncQuestionPrice: 1,
    pillPrice: 0,
    reschedulePrice: 0,
    cancellation: {
      freeCancelHoursBefore: 12,
      menteeNoShowRefund: 'none',
      mentorNoShowRefund: 'full',
      mentorNoShowCompensation: 1,
    },
    gift: {
      enabled: true,
      amount: 1,
      quotaMonthly: 3,
      quotaAccumulates: false,
      requiresReview: true,
    },
    mentorEarnsCoinPerDonatedHour: false,
    menteeEarnsCoinForContributing: false,
  },

  flags: {
    groupFormat: false,
    asyncQuestions: false,
    pills: false,
    tracks: false,
    aiMatching: false,
    whatsappCheckins: false,
    sponsorConsole: false,
    spontaneousApplications: true,
  },

  version: 1,
  publishedBy: null,
  publishedAt: null,
};
