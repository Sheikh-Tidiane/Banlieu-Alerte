import { getPrisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type { ListReportsFilters } from '@/validators/report';
import { toPublicComment } from './comments';
import { toPublicDetail, toPublicSummary } from './public';
import { isTrackingCode } from './tracking-code';

export const LIST_LIMIT = 500;

const summarySelect = {
  trackingCode: true,
  type: true,
  severity: true,
  status: true,
  lat: true,
  lng: true,
  confirmationCount: true,
  createdAt: true,
  isDemo: true,
  neighborhood: { select: { id: true, name: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.ReportSelect;

/** Signalements publics, filtrés (carte et listes). Les signalements rejetés sont exclus. */
export async function listPublicReports(
  filters: Partial<ListReportsFilters> = {},
  limit = LIST_LIMIT,
) {
  const where: Prisma.ReportWhereInput = {
    status: filters.status
      ? { in: filters.status.filter((s) => s !== 'REJECTED') }
      : { not: 'REJECTED' },
    ...(filters.type ? { type: { in: filters.type } } : {}),
    ...(filters.severity ? { severity: { in: filters.severity } } : {}),
    ...(filters.neighborhoodId ? { neighborhoodId: filters.neighborhoodId } : {}),
    ...(filters.days
      ? { createdAt: { gte: new Date(Date.now() - filters.days * 86_400_000) } }
      : {}),
    ...(filters.bbox
      ? {
          lat: { gte: filters.bbox.minLat, lte: filters.bbox.maxLat },
          lng: { gte: filters.bbox.minLng, lte: filters.bbox.maxLng },
        }
      : {}),
  };
  const rows = await getPrisma().report.findMany({
    where,
    select: summarySelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(toPublicSummary);
}

export async function getPublicReport(trackingCode: string) {
  if (!isTrackingCode(trackingCode)) return null;
  const report = await getPrisma().report.findUnique({
    where: { trackingCode },
    select: {
      ...summarySelect,
      description: true,
      isApproximate: true,
      resolvedAt: true,
      photos: {
        select: { storageKey: true, width: true, height: true },
        orderBy: { createdAt: 'asc' },
      },
      // Auteur du changement : seulement pour repérer une réouverture par l'habitant (jamais exposé).
      authorId: true,
      statusHistory: {
        select: { fromStatus: true, toStatus: true, createdAt: true, changedById: true },
        orderBy: { createdAt: 'asc' },
      },
      comments: {
        where: { isInternal: false, status: 'PUBLISHED' },
        select: { id: true, body: true, createdAt: true, author: { select: { role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!report || report.status === 'REJECTED') return null;
  return { ...toPublicDetail(report), comments: report.comments.map(toPublicComment) };
}

/** Doublon fusionné (D-038) : numéro du signalement principal, pour rediriger. */
export async function findMergeTarget(trackingCode: string): Promise<string | null> {
  if (!isTrackingCode(trackingCode)) return null;
  const report = await getPrisma().report.findUnique({
    where: { trackingCode },
    select: { duplicateOf: { select: { trackingCode: true } } },
  });
  return report?.duplicateOf?.trackingCode ?? null;
}

/**
 * Chiffres de l'accueil, calculés sur la base uniquement (CDC §1.3).
 * `onlyDemo` : vrai si tous les signalements sont des données de démonstration.
 */
export async function getPublicStats() {
  const prisma = getPrisma();
  const visible = { status: { not: 'REJECTED' as const } };
  const [total, resolved, lastWeek, real] = await Promise.all([
    prisma.report.count({ where: visible }),
    prisma.report.count({ where: { status: 'RESOLVED' } }),
    prisma.report.count({
      where: { ...visible, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    prisma.report.count({ where: { ...visible, isDemo: false } }),
  ]);
  return { total, resolved, lastWeek, onlyDemo: total > 0 && real === 0 };
}
