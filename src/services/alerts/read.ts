import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db';
import type { RiskLevelCode } from '@/lib/risk/types';
import { alertScopeWhere } from '@/permissions/scope';
import { canIssueAlert } from '@/permissions/policies';
import type { AuthUser } from '@/permissions/types';
import { ServiceError } from '@/services/errors';

// Lectures des alertes. Public : alertes envoyées, sans créateur, approbateur ni livraisons.

export type PublicAlert = {
  id: string;
  type: 'OFFICIAL' | 'INDICATIVE';
  level: RiskLevelCode;
  issuerName: string;
  title: string;
  messageFr: string;
  /** Présent seulement si relu par un locuteur natif. */
  messageWo: string | null;
  advice: string | null;
  validFrom: string;
  validUntil: string;
  sentAt: string | null;
  /** Levée avant la fin prévue. */
  cancelled: boolean;
  neighborhoods: string[];
  isDemo: boolean;
};

const publicSelect = {
  id: true,
  type: true,
  status: true,
  level: true,
  issuerName: true,
  title: true,
  messageFr: true,
  messageWo: true,
  woReviewed: true,
  advice: true,
  validFrom: true,
  validUntil: true,
  sentAt: true,
  isDemo: true,
  neighborhoods: { select: { neighborhood: { select: { name: true } } } },
} satisfies Prisma.AlertSelect;

type PublicRow = Prisma.AlertGetPayload<{ select: typeof publicSelect }>;

export function toPublicAlert(row: PublicRow): PublicAlert {
  return {
    id: row.id,
    type: row.type,
    level: row.level,
    issuerName: row.issuerName,
    title: row.title,
    messageFr: row.messageFr,
    messageWo: row.woReviewed ? row.messageWo : null,
    advice: row.advice,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    cancelled: row.status === 'CANCELLED',
    neighborhoods: row.neighborhoods
      .map((n) => n.neighborhood.name)
      .sort((a, b) => a.localeCompare(b, 'fr')),
    isDemo: row.isDemo,
  };
}

/** Alertes en cours : envoyées et dans leur période de validité. */
export async function listActiveAlerts(now = new Date()): Promise<PublicAlert[]> {
  const rows = await getPrisma().alert.findMany({
    where: { status: 'SENT', validFrom: { lte: now }, validUntil: { gt: now } },
    orderBy: [{ type: 'asc' }, { sentAt: 'desc' }],
    select: publicSelect,
  });
  return rows.map(toPublicAlert);
}

/** Historique : alertes envoyées puis terminées ou levées. */
export async function listPastAlerts(now = new Date(), take = 20): Promise<PublicAlert[]> {
  const rows = await getPrisma().alert.findMany({
    where: {
      sentAt: { not: null },
      OR: [{ status: 'CANCELLED' }, { status: 'SENT', validUntil: { lte: now } }],
    },
    orderBy: { sentAt: 'desc' },
    take,
    select: publicSelect,
  });
  return rows.map(toPublicAlert);
}

// --- Back-office -------------------------------------------------------------------

export const ALERT_STATUSES = [
  'PENDING_APPROVAL',
  'SCHEDULED',
  'APPROVED',
  'SENT',
  'REJECTED',
  'CANCELLED',
] as const;

export async function listStaffAlerts(user: AuthUser, status?: (typeof ALERT_STATUSES)[number]) {
  return getPrisma().alert.findMany({
    where: { AND: [alertScopeWhere(user), status ? { status } : {}] },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      type: true,
      status: true,
      origin: true,
      level: true,
      title: true,
      validUntil: true,
      createdAt: true,
      isDemo: true,
      neighborhoods: { select: { neighborhood: { select: { name: true } } } },
      _count: { select: { deliveries: true } },
    },
  });
}

export async function countPendingAlerts(user: AuthUser) {
  return getPrisma().alert.count({
    where: { AND: [alertScopeWhere(user), { status: 'PENDING_APPROVAL' }] },
  });
}

export async function getStaffAlert(user: AuthUser, id: string) {
  const prisma = getPrisma();
  const alert = await prisma.alert.findFirst({
    where: { AND: [{ id }, alertScopeWhere(user)] },
    select: {
      ...publicSelect,
      origin: true,
      scheduledAt: true,
      createdAt: true,
      createdBy: { select: { name: true, role: true } },
      riskPrediction: {
        select: {
          score: true,
          horizonHours: true,
          factors: true,
          weatherFetchedAt: true,
          ruleVersion: { select: { number: true } },
        },
      },
      neighborhoods: {
        select: { neighborhood: { select: { id: true, name: true, communeId: true } } },
      },
      approvals: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          decision: true,
          reason: true,
          changes: true,
          createdAt: true,
          approver: { select: { name: true, role: true } },
        },
      },
    },
  });
  if (!alert) throw new ServiceError('NOT_FOUND', 'Alerte introuvable.');

  const deliveries = await prisma.alertDelivery.groupBy({
    by: ['channel', 'status', 'mode'],
    where: { alertId: id },
    _count: { _all: true },
  });
  const failures = await prisma.alertDelivery.findMany({
    where: { alertId: id, status: 'FAILED' },
    select: { id: true, channel: true, error: true, createdAt: true },
    take: 20,
  });
  const targets = alert.neighborhoods.map((n) => n.neighborhood);
  return {
    alert,
    targets,
    deliveries: deliveries.map((d) => ({
      channel: d.channel,
      status: d.status,
      mode: d.mode,
      count: d._count._all,
    })),
    failures,
    canAct: canIssueAlert(user, alert.type, targets),
  };
}

/** Quartiers que l'utilisateur peut viser dans une alerte (D-049). */
export async function listAlertableNeighborhoods(user: AuthUser) {
  const where: Prisma.NeighborhoodWhereInput =
    user.role === 'ADMIN'
      ? {}
      : user.role === 'AGENT'
        ? { communeId: user.communeId ?? '__none__' }
        : user.role === 'DELEGATE'
          ? { id: { in: user.neighborhoodIds } }
          : { id: { in: [] } };
  return getPrisma().neighborhood.findMany({
    where,
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}
