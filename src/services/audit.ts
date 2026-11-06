import { getPrisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

// Journal d'audit des actions sensibles (EXG-18). Les métadonnées ne contiennent jamais de
// donnée personnelle ni de secret : les clés suspectes sont retirées avant écriture.

export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_reset_created'
  | 'auth.password_reset_used'
  | 'report.status_changed'
  | 'report.assigned'
  | 'report.note_added'
  | 'report.merged'
  | 'invitation.created'
  | 'invitation.accepted'
  | 'invitation.revoked'
  | 'comment.created'
  | 'comment.hidden'
  | 'comment.restored'
  | 'abuse.dismissed'
  | 'user.blocked'
  | 'user.unblocked'
  | 'account.exported'
  | 'account.deleted'
  | 'zone.created'
  | 'zone.updated'
  | 'zone.deleted'
  | 'risk.refreshed'
  | 'risk.rules_created'
  | 'risk.rules_activated'
  | 'alert.created'
  | 'alert.draft_created'
  | 'alert.updated'
  | 'alert.approved'
  | 'alert.rejected'
  | 'alert.cancelled'
  | 'alert.sent'
  | 'subscription.created'
  | 'subscription.deleted'
  | 'report.resolution_confirmed'
  | 'report.reopened_by_author'
  | 'report.escalated'
  | 'episode.created'
  | 'episode.validated'
  | 'episode.label_set'
  | 'cleanup.created'
  | 'cleanup.updated'
  | 'escalation.rules_updated'
  | 'demo.simulated'
  | 'demo.reset'
  | 'auth.mfa_enrolled'
  | 'auth.mfa_verified'
  | 'auth.mfa_failed'
  | 'auth.mfa_recovery_used'
  | 'auth.mfa_reset'
  | 'data.purged';

type AuditEntry = {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const FORBIDDEN_FRAGMENT = /mail|phone|password|token|secret|hash/i;
const FORBIDDEN_KEY = /^(name|ip|tel|address)$/i;

/** Retire toute clé qui pourrait porter une donnée personnelle ou un secret. */
export function sanitizeMetadata(
  metadata: AuditEntry['metadata'],
): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key]) => !FORBIDDEN_FRAGMENT.test(key) && !FORBIDDEN_KEY.test(key),
    ),
  );
}

type AuditClient = Pick<ReturnType<typeof getPrisma>, 'auditLog'>;

export async function recordAudit(entry: AuditEntry, client: AuditClient = getPrisma()) {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: sanitizeMetadata(entry.metadata),
    },
  });
}

export const AUDIT_PAGE_SIZE = 50;

/** Journal consultable par l'administrateur (EXG-18), du plus récent au plus ancien. */
export async function listAudit(page: number) {
  const prisma = getPrisma();
  const [total, rows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
  ]);
  return { rows, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}
