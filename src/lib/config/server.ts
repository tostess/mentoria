import 'server-only';

import { DEFAULT_ORG_ID } from '@/lib/auth/roles';
import { DEFAULT_APP_CONFIG } from '@/lib/config/defaults';
import type { AppConfig } from '@/lib/config/types';

/**
 * Le `appConfig/{orgId}` — fonte de verdade de taxonomia, textos, branding e
 * politica de moedas (invariante 8).
 *
 * Se o documento ainda nao existe (projeto novo, sem seed) ou se nao ha
 * credencial de servidor, cai nos defaults para a UI nao quebrar. Regra de
 * negocio nao deve depender desse fallback: rode `npm run seed:config`.
 */
export async function getAppConfig(orgId: string = DEFAULT_ORG_ID): Promise<AppConfig> {
  try {
    const { getAdmin } = await import('@/lib/firebase/admin');
    const { db } = getAdmin();
    const snap = await db.collection('appConfig').doc(orgId).get();
    if (!snap.exists) return { ...DEFAULT_APP_CONFIG, orgId };
    return { ...DEFAULT_APP_CONFIG, ...(snap.data() as Partial<AppConfig>), orgId };
  } catch {
    return { ...DEFAULT_APP_CONFIG, orgId };
  }
}
