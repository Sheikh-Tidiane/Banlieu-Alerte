import { getPrisma } from '@/lib/db';
import { boundingBox, distanceMeters } from '@/lib/geo/distance';
import type { Prisma } from '@/generated/prisma/client';
import {
  allowedTransitions,
  canAddNote,
  canAssign,
  canModerate,
  isReportInScope,
} from '@/permissions/policies';
import { reportScopeWhere } from '@/permissions/scope';
import type { AuthUser, ScopedReport } from '@/permissions/types';
import { ServiceError } from '@/services/errors';
import type { StaffListFilters } from '@/validators/backoffice';

// Lecture des signalements pour le back-office. Toutes les requêtes passent par
// `reportScopeWhere` (portée géographique, D-036).

export const STAFF_PAGE_SIZE = 25;

const listSelect = {
  id: true,
  trackingCode: true,
  type: true,
  severity: true,
  status: true,
  confirmationCount: true,
  createdAt: true,
  isDemo: true,
  escalationLevel: true,
  neighborhood: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.ReportSelect;

export async function listStaffReports(user: AuthUser, filters: StaffListFilters) {
  const where: Prisma.ReportWhereInput = {
    AND: [
      reportScopeWhere(user),
      filters.status.length ? { status: { in: filters.status } } : {},
      filters.type.length ? { type: { in: filters.type } } : {},
      filters.severity.length ? { severity: { in: filters.severity } } : {},
      filters.neighborhoodId ? { neighborhoodId: filters.neighborhoodId } : {},
      filters.unidentified ? { neighborhoodId: null } : {},
      filters.assigned === 'me' ? { assigneeId: user.id } : {},
      filters.assigned === 'none' ? { assigneeId: null } : {},
      filters.q ? { trackingCode: { contains: filters.q } } : {},
    ],
  };
  const prisma = getPrisma();
  const [total, rows] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      select: listSelect,
      orderBy: [{ createdAt: 'desc' }],
      skip: (filters.page - 1) * STAFF_PAGE_SIZE,
      take: STAFF_PAGE_SIZE,
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE)) };
}

/** Champs nécessaires aux politiques d'accès. */
export const scopeSelect = {
  id: true,
  status: true,
  neighborhoodId: true,
  neighborhood: { select: { communeId: true } },
} satisfies Prisma.ReportSelect;

/** Signalement de la portée de l'utilisateur, ou erreur (404 inconnu, 403 hors portée). */
export async function findScopedReport<S extends Prisma.ReportSelect>(
  user: AuthUser,
  trackingCode: string,
  select: S,
) {
  const report = (await getPrisma().report.findUnique({
    where: { trackingCode },
    select: { ...scopeSelect, ...select },
  })) as Prisma.ReportGetPayload<{ select: typeof scopeSelect & S }> | null;
  if (!report) throw new ServiceError('NOT_FOUND', 'Signalement introuvable.');
  // TypeScript ne résout pas le type générique ici ; scopeSelect garantit ces champs.
  if (!isReportInScope(user, report as unknown as ScopedReport)) {
    throw new ServiceError('FORBIDDEN', 'Ce signalement est hors de votre périmètre.');
  }
  return report;
}

const NEARBY_RADIUS_METERS = 200;

/** Fiche de traitement complète (données internes comprises : réservée au back-office). */
export async function getStaffReport(user: AuthUser, trackingCode: string) {
  const report = await findScopedReport(user, trackingCode, {
    trackingCode: true,
    type: true,
    severity: true,
    description: true,
    lat: true,
    lng: true,
    attachment: true,
    isApproximate: true,
    confirmationCount: true,
    createdAt: true,
    resolvedAt: true,
    isDemo: true,
    escalationLevel: true,
    resolutionFeedback: true,
    authorId: true,
    neighborhood: { select: { id: true, name: true, communeId: true } },
    assignee: { select: { id: true, name: true } },
    duplicateOf: { select: { trackingCode: true } },
    duplicates: { select: { trackingCode: true } },
    photos: { select: { storageKey: true, width: true, height: true } },
    statusHistory: {
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        createdAt: true,
        changedBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    },
    comments: {
      select: {
        id: true,
        body: true,
        isInternal: true,
        status: true,
        createdAt: true,
        author: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    },
    abuseFlags: {
      select: { id: true, reason: true, status: true, createdAt: true },
      where: { status: 'OPEN' },
    },
  });

  const lat = Number(report.lat);
  const lng = Number(report.lng);
  const box = boundingBox({ lat, lng }, NEARBY_RADIUS_METERS);
  const candidates = await getPrisma().report.findMany({
    where: {
      AND: [
        reportScopeWhere(user),
        { id: { not: report.id }, type: report.type, duplicateOfId: null },
        { status: { notIn: ['REJECTED'] } },
        { lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } },
      ],
    },
    select: { trackingCode: true, status: true, createdAt: true, lat: true, lng: true },
    take: 10,
  });
  const nearby = candidates
    .map((c) => ({
      ...c,
      distance: Math.round(
        distanceMeters({ lat, lng }, { lat: Number(c.lat), lng: Number(c.lng) }),
      ),
    }))
    .filter((c) => c.distance <= NEARBY_RADIUS_METERS)
    .sort((a, b) => a.distance - b.distance)
    .map(({ trackingCode, status, createdAt, distance }) => ({
      trackingCode,
      status,
      createdAt,
      distance,
    }));

  const assignable = canAssign(user, report)
    ? await listAssignableAgents(report.neighborhood?.communeId ?? null)
    : [];

  return {
    ...report,
    lat,
    lng,
    // Minimisation : le back-office sait s'il y a un compte, sans voir qui.
    hasAuthorAccount: report.authorId !== null,
    authorId: undefined,
    nearby,
    assignable,
    permissions: {
      transitions: allowedTransitions(user, report),
      canAssign: canAssign(user, report),
      canAddNote: canAddNote(user, report),
      canMerge: user.role === 'AGENT' || user.role === 'ADMIN',
      canModerate: canModerate(user, report),
    },
  };
}

/** Agents actifs pouvant traiter un signalement (sa commune ; tous si sans quartier). */
export async function listAssignableAgents(communeId: string | null) {
  return getPrisma().user.findMany({
    where: { role: 'AGENT', status: 'ACTIVE', ...(communeId ? { communeId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
