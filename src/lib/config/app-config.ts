/**
 * `app_config` tipada. O banco guarda jsonb; a aplicação não lê jsonb solto.
 *
 * A política da ficha, os limites e o vocabulário nascem no banco de
 * propósito: mudar a alocação mensal ou o nome de "ficha" para uma empresa
 * não pode exigir deploy. O preço disso é que o formato não é garantido pelo
 * Postgres, então a validação acontece aqui — chave desconhecida é ignorada,
 * valor do tipo errado cai no default, e nenhum dos dois derruba a tela.
 *
 * Módulo puro: parse e defaults. Quem busca no banco é `config/load.ts`.
 */

import { DEFAULT_TERMS, resolveTerms, type Terms } from "@/lib/terms";
import { normalizeHex, type Branding } from "@/lib/theme";

export type FichaPolicy = {
  defaultAllocationPerUser: number;
  /** Invariante: fichas acumulam. Ligar isto é decisão de produto, não bug. */
  expires: boolean;
  maxBalance: number;
  price30: number;
  cancelWindowHours: number;
  partnerNoShowBonus: number;
  /**
   * A política da plataforma. O presente confere a cota em
   * `partners.gift_quota_monthly`, que é da pessoa e pode divergir desta.
   */
  giftQuotaMonthly: number;
  idleNudgeAfterDays: number;
};

export type Limits = {
  bookingHorizonDays: number;
  maxPendingPerProfessional: number;
  pendingExpiresHours: number;
  minNoticeHours: number;
  sessionGraceMinutes: number;
};

export type Flags = {
  /** Em aberto: Parceiro ganha ficha por hora doada? */
  partnerEarnsFichas: boolean;
};

/**
 * LGPD: a controladora é a empresa da operadora. O texto é fornecido por ela
 * e apenas inserido aqui — a plataforma não redige nem versiona política.
 */
export type Legal = {
  termsUrl: string | null;
  privacyUrl: string | null;
  /**
   * A versão dos textos em vigor (`copy.legal.version`), gravada no pedido de
   * cadastro como a versão que a pessoa aceitou. Nula enquanto a operadora não
   * publicar os textos (A5).
   */
  versao: string | null;
};

/** O que muda por empresa no white-label. Definido junto do tema que o usa. */
export type { Branding };

/**
 * Um pacote que a conta pessoal compra. O preço é em centavos, inteiro — real
 * em ponto flutuante soma R$ 0,30 errado.
 */
export type Pacote = {
  id: string;
  nome: string;
  fichas: number;
  precoCentavos: number;
  /** Parcelas sem juros no cartão. 1 é à vista. */
  parcelasMax: number;
  ativo: boolean;
};

/** A regra da conta pessoal que não vale para empresa. */
export type IndividualPolicy = {
  /** Validade da ficha comprada, em meses, contada do pagamento. */
  validadeMeses: number;
  /** Prazo do arrependimento (CDC art. 49), em dias. */
  arrependimentoDias: number;
};

export type AppConfig = {
  fichaPolicy: FichaPolicy;
  limits: Limits;
  flags: Flags;
  terms: Terms;
  legal: Legal;
  branding: Branding;
  pacotes: Pacote[];
  individualPolicy: IndividualPolicy;
};

export const DEFAULT_FICHA_POLICY: FichaPolicy = {
  defaultAllocationPerUser: 2,
  expires: false,
  maxBalance: 6,
  price30: 1,
  cancelWindowHours: 12,
  partnerNoShowBonus: 1,
  giftQuotaMonthly: 3,
  idleNudgeAfterDays: 21,
};

export const DEFAULT_LIMITS: Limits = {
  bookingHorizonDays: 14,
  maxPendingPerProfessional: 2,
  pendingExpiresHours: 48,
  minNoticeHours: 12,
  sessionGraceMinutes: 15,
};

export const DEFAULT_FLAGS: Flags = { partnerEarnsFichas: false };

export const DEFAULT_LEGAL: Legal = { termsUrl: null, privacyUrl: null, versao: null };

export const DEFAULT_BRANDING: Branding = { accent: null, name: null, logoUrl: null };

/** Os três pacotes de 01/10/2026 — os mesmos que a migração `conta_individual` semeia. */
export const DEFAULT_PACOTES: Pacote[] = [
  {
    id: "primeira-conversa",
    nome: "Primeira conversa",
    fichas: 1,
    precoCentavos: 12_900,
    parcelasMax: 1,
    ativo: true,
  },
  { id: "ritmo", nome: "Ritmo", fichas: 4, precoCentavos: 44_900, parcelasMax: 2, ativo: true },
  { id: "jornada", nome: "Jornada", fichas: 8, precoCentavos: 79_900, parcelasMax: 3, ativo: true },
];

export const DEFAULT_INDIVIDUAL_POLICY: IndividualPolicy = {
  validadeMeses: 12,
  arrependimentoDias: 7,
};

/**
 * O que a aplicação usa quando o banco não respondeu. São os mesmos números
 * que a migração semeia — os defaults existem para a tela subir, não para
 * divergir do banco.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  fichaPolicy: DEFAULT_FICHA_POLICY,
  limits: DEFAULT_LIMITS,
  flags: DEFAULT_FLAGS,
  terms: DEFAULT_TERMS,
  legal: DEFAULT_LEGAL,
  branding: DEFAULT_BRANDING,
  pacotes: DEFAULT_PACOTES,
  individualPolicy: DEFAULT_INDIVIDUAL_POLICY,
};

export type ConfigRow = { key: string; value: unknown };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Inteiro não negativo, ou o default. `NaN` e string numérica não passam. */
function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseFichaPolicy(value: unknown): FichaPolicy {
  const v = asRecord(value);
  const d = DEFAULT_FICHA_POLICY;
  return {
    defaultAllocationPerUser: int(v.default_allocation_per_user, d.defaultAllocationPerUser),
    expires: bool(v.expires, d.expires),
    maxBalance: int(v.max_balance, d.maxBalance),
    price30: int(v.price_30, d.price30),
    cancelWindowHours: int(v.cancel_window_hours, d.cancelWindowHours),
    partnerNoShowBonus: int(v.partner_no_show_bonus, d.partnerNoShowBonus),
    giftQuotaMonthly: int(v.gift_quota_monthly, d.giftQuotaMonthly),
    idleNudgeAfterDays: int(v.idle_nudge_after_days, d.idleNudgeAfterDays),
  };
}

function parseLimits(value: unknown): Limits {
  const v = asRecord(value);
  const d = DEFAULT_LIMITS;
  return {
    bookingHorizonDays: int(v.booking_horizon_days, d.bookingHorizonDays),
    maxPendingPerProfessional: int(v.max_pending_per_professional, d.maxPendingPerProfessional),
    pendingExpiresHours: int(v.pending_expires_hours, d.pendingExpiresHours),
    minNoticeHours: int(v.min_notice_hours, d.minNoticeHours),
    sessionGraceMinutes: int(v.session_grace_minutes, d.sessionGraceMinutes),
  };
}

function parseFlags(value: unknown): Flags {
  const v = asRecord(value);
  return { partnerEarnsFichas: bool(v.partner_earns_fichas, DEFAULT_FLAGS.partnerEarnsFichas) };
}

function parseLegal(value: unknown): Legal {
  const v = asRecord(value);
  return { termsUrl: str(v.terms_url), privacyUrl: str(v.privacy_url), versao: str(v.version) };
}

const ID_DE_PACOTE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Pacote mal formado sai da lista em vez de derrubar a vitrine; id repetido
 * fica com o primeiro, porque o id é o que o pagamento grava. Lista vazia — ou
 * a chave inteira ausente — volta aos pacotes default: uma vitrine sem nada à
 * venda não é configuração, é defeito.
 */
function parsePacotes(value: unknown): Pacote[] {
  const lista = asRecord(value).pacotes;
  if (!Array.isArray(lista)) return DEFAULT_PACOTES;

  const vistos = new Set<string>();
  const pacotes: Pacote[] = [];
  for (const item of lista) {
    const v = asRecord(item);
    const id = str(v.id);
    const nome = str(v.nome);
    const fichas = int(v.fichas, 0);
    const preco = int(v.preco_centavos, -1);
    if (id === null || !ID_DE_PACOTE.test(id) || vistos.has(id)) continue;
    if (nome === null || fichas < 1 || preco < 0) continue;
    vistos.add(id);
    pacotes.push({
      id,
      nome,
      fichas,
      precoCentavos: preco,
      parcelasMax: Math.max(1, int(v.parcelas_max, 1)),
      ativo: bool(v.ativo, true),
    });
  }
  return pacotes.length === 0 ? DEFAULT_PACOTES : pacotes;
}

function parseIndividualPolicy(value: unknown): IndividualPolicy {
  const v = asRecord(value);
  const d = DEFAULT_INDIVIDUAL_POLICY;
  const validade = int(v.validade_meses, d.validadeMeses);
  return {
    // Zero meses seria ficha vencida na compra: cai no default.
    validadeMeses: validade < 1 ? d.validadeMeses : validade,
    arrependimentoDias: int(v.arrependimento_dias, d.arrependimentoDias),
  };
}

/**
 * Accent inválido cai no default em vez de pintar a interface de nada: o
 * valor vai para `style` inline, e um hex quebrado apagaria o contraste do
 * item ativo da navegação sem erro nenhum.
 */
export function parseBranding(value: unknown): Branding {
  const v = asRecord(value);
  return {
    accent: normalizeHex(str(v.accent)),
    name: str(v.name),
    logoUrl: str(v.logo_url) ?? str(v.logoUrl),
  };
}

export function parseAppConfig(rows: readonly ConfigRow[]): AppConfig {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const copy = asRecord(byKey.get("copy"));

  return {
    fichaPolicy: parseFichaPolicy(byKey.get("ficha_policy")),
    limits: parseLimits(byKey.get("limits")),
    flags: parseFlags(byKey.get("flags")),
    terms: resolveTerms(copy.terms),
    legal: parseLegal(copy.legal),
    branding: parseBranding(byKey.get("branding")),
    pacotes: parsePacotes(byKey.get("individual_packages")),
    individualPolicy: parseIndividualPolicy(byKey.get("individual_policy")),
  };
}

/**
 * Personalização da empresa por cima da plataforma, campo a campo. Empresa
 * que define só o logotipo continua com o accent da plataforma — o contrário
 * (herdar tudo ou nada) obrigaria o RH a recadastrar o que não quis mudar.
 */
export function mergeBranding(platform: Branding, org: Branding | null): Branding {
  if (org === null) return platform;
  return {
    accent: org.accent ?? platform.accent,
    name: org.name ?? platform.name,
    logoUrl: org.logoUrl ?? platform.logoUrl,
  };
}
