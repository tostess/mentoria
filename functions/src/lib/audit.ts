import { FieldValue } from 'firebase-admin/firestore';

import { db } from './admin';

/**
 * INVARIANTE 11: toda acao de admin ou moderador gera `auditLogs`.
 * Append-only, escrito somente pelo Admin SDK.
 */
export async function writeAuditLog(entry: {
  orgId: string;
  actorUid: string;
  action: string;
  targetRef: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.collection('auditLogs').add({
    orgId: entry.orgId,
    actorUid: entry.actorUid,
    action: entry.action,
    targetRef: entry.targetRef,
    before: entry.before ?? null,
    after: entry.after ?? null,
    at: FieldValue.serverTimestamp(),
  });
}
