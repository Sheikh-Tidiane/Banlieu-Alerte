import { getPrisma } from '@/lib/db';
import { cleanupPriority, sortByPriority } from '@/lib/cleanup/priority';
import { distanceMeters } from '@/lib/geo/distance';
import { PhotoRejectedError, processPhoto } from '@/lib/photos/process';
import { photoStorage } from '@/lib/photos/storage';
import { compareLevels } from '@/lib/risk/score';
import { allowedTransitions } from '@/permissions/policies';
import { reportScopeWhere } from '@/permissions/scope';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { changeStatus } from '@/services/backoffice/processing';
import { findScopedReport } from '@/services/backoffice/reports';
import { ServiceError } from '@/services/errors';

// Curage (CDC §4.7, D-058) : liste priorisée des caniveaux obstrués et dépôts, opérations
// avec équipe, statut et photos avant / après.

const CLEANUP_TYPES = ['BLOCKED_DRAIN', 'WASTE_DUMP'] as const;
export const MAX_PHOTOS_PER_PHASE = 4;

function requireCleanupManager(user: AuthUser) {
  if (user.role !== 'AGENT' && user.role !== 'ADMIN') {
    throw new ServiceError('FORBIDDEN', 'Réservé aux agents et administrateurs.');
  }
}

/** Indice à 48 h de chaque case, dernière exécution. */
async function latestCellScores() {
  const prisma = getPrisma();
  const run = await prisma.riskRun.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!run) return { cells: [], heavyRain: false };
  const [cells, neighborhoods] = await Promise.all([
    prisma.riskPrediction.findMany({
      where: { runId: run.id, scope: 'CELL', horizonHours: 48 },
      select: {
        score: true,
        cell: { select: { centerLat: true, centerLng: true, sizeMeters: true } },
      },
    }),
    prisma.riskPrediction.findMany({
      where: { runId: run.id, scope: 'NEIGHBORHOOD' },
      select: { level: true },
    }),
  ]);
  return {
    cells: cells
      .filter((c) => c.cell)
      .map((c) => ({
        score: c.score,
        lat: Number(c.cell!.centerLat),
        lng: Number(c.cell!.centerLng),
        sizeMeters: c.cell!.sizeMeters,
      })),
    heavyRain: neighborhoods.some((n) => n.level && compareLevels(n.level, 'HIGH') >= 0),
  };
}

export async function listCleanupPriorities(user: AuthUser) {
  const prisma = getPrisma();
  const reports = await prisma.report.findMany({
    where: {
      AND: [
        reportScopeWhere(user),
        {
          type: { in: [...CLEANUP_TYPES] },
          status: { notIn: ['RESOLVED', 'REJECTED'] },
          duplicateOfId: null,
        },
      ],
    },
    select: {
      id: true,
      trackingCode: true,
      type: true,
      severity: true,
      status: true,
      lat: true,
      lng: true,
      createdAt: true,
      isDemo: true,
      neighborhood: { select: { name: true } },
      cleanups: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, team: true, plannedFor: true },
      },
    },
    take: 300,
  });
  const { cells, heavyRain } = await latestCellScores();

  const items = reports.map((report) => {
    const point = { lat: Number(report.lat), lng: Number(report.lng) };
    let riskScore: number | null = null;
    let best = Infinity;
    for (const cell of cells) {
      const d = distanceMeters(point, cell);
      if (d < best && d <= (cell.sizeMeters * Math.SQRT2) / 2) {
        best = d;
        riskScore = cell.score;
      }
    }
    return {
      id: report.id,
      trackingCode: report.trackingCode,
      type: report.type,
      severity: report.severity,
      status: report.status,
      createdAt: report.createdAt,
      isDemo: report.isDemo,
      neighborhood: report.neighborhood?.name ?? null,
      riskScore,
      operation: report.cleanups[0] ?? null,
    };
  });
  const sorted = sortByPriority(items).map((item) => ({
    ...item,
    priority: cleanupPriority(item),
  }));
  const untreated = sorted.filter((i) => !i.operation || i.operation.status !== 'DONE').length;
  return { items: sorted, heavyRain, untreated };
}

export async function listOperations(user: AuthUser) {
  return getPrisma().cleanupOperation.findMany({
    where: { report: reportScopeWhere(user) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      team: true,
      status: true,
      plannedFor: true,
      completedAt: true,
      note: true,
      isDemo: true,
      createdAt: true,
      report: { select: { trackingCode: true, type: true, status: true } },
      photos: { select: { id: true, phase: true, storageKey: true } },
    },
  });
}

export async function createOperation(
  user: AuthUser,
  input: { trackingCode: string; team: string; plannedFor?: Date; note?: string },
) {
  requireCleanupManager(user);
  const report = await findScopedReport(user, input.trackingCode, {
    type: true,
    isDemo: true,
  });
  if (!(CLEANUP_TYPES as readonly string[]).includes(report.type)) {
    throw new ServiceError('VALIDATION_ERROR', 'Le curage concerne les caniveaux et les dépôts.');
  }
  return getPrisma().$transaction(async (tx) => {
    const operation = await tx.cleanupOperation.create({
      data: {
        reportId: report.id,
        team: input.team,
        plannedFor: input.plannedFor ?? null,
        note: input.note ?? null,
        createdById: user.id,
        isDemo: report.isDemo,
      },
      select: { id: true },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'cleanup.created',
        entityType: 'cleanup',
        entityId: operation.id,
      },
      tx,
    );
    return operation;
  });
}

async function loadOperation(user: AuthUser, id: string) {
  const operation = await getPrisma().cleanupOperation.findFirst({
    where: { id, report: reportScopeWhere(user) },
    select: {
      id: true,
      status: true,
      report: { select: { trackingCode: true } },
      _count: { select: { photos: true } },
    },
  });
  if (!operation) throw new ServiceError('NOT_FOUND', 'Opération introuvable.');
  return operation;
}

export async function updateOperation(
  user: AuthUser,
  id: string,
  input: {
    status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
    note?: string;
    resolveReport?: boolean;
  },
) {
  requireCleanupManager(user);
  const operation = await loadOperation(user, id);
  if (operation.status === 'DONE' || operation.status === 'CANCELLED') {
    throw new ServiceError('CONFLICT', 'Opération clôturée.');
  }
  await getPrisma().$transaction(async (tx) => {
    await tx.cleanupOperation.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.status === 'DONE' ? { completedAt: new Date() } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'cleanup.updated',
        entityType: 'cleanup',
        entityId: id,
        metadata: { status: input.status ?? null },
      },
      tx,
    );
  });

  // Une opération terminée peut résoudre le signalement lié (transitions autorisées seulement).
  if (input.status === 'DONE' && input.resolveReport) {
    const code = operation.report.trackingCode;
    let report = await findScopedReport(user, code, {});
    if (!allowedTransitions(user, report).includes('RESOLVED')) {
      if (allowedTransitions(user, report).includes('IN_PROGRESS')) {
        await changeStatus(user, code, 'IN_PROGRESS');
        report = await findScopedReport(user, code, {});
      }
    }
    if (allowedTransitions(user, report).includes('RESOLVED')) {
      await changeStatus(user, code, 'RESOLVED');
    }
  }
  return { id };
}

export async function addCleanupPhoto(
  user: AuthUser,
  id: string,
  phase: 'BEFORE' | 'AFTER',
  data: Buffer,
) {
  requireCleanupManager(user);
  await loadOperation(user, id);
  const count = await getPrisma().cleanupPhoto.count({ where: { operationId: id, phase } });
  if (count >= MAX_PHOTOS_PER_PHASE) {
    throw new ServiceError('CONFLICT', `${MAX_PHOTOS_PER_PHASE} photos au plus par étape.`);
  }
  // Même traitement que les signalements : type vérifié, EXIF retiré, ré-encodage (D-024).
  let photo: Awaited<ReturnType<typeof processPhoto>>;
  try {
    photo = await processPhoto(data);
  } catch (error) {
    if (error instanceof PhotoRejectedError) {
      throw new ServiceError('VALIDATION_ERROR', error.message, { photo: [error.message] });
    }
    throw error;
  }
  const storageKey = await photoStorage.save(photo.data);
  const saved = await getPrisma().cleanupPhoto.create({
    data: {
      operationId: id,
      phase,
      storageKey,
      mimeType: photo.mimeType,
      sizeBytes: photo.data.length,
      width: photo.width,
      height: photo.height,
    },
    select: { id: true, storageKey: true },
  });
  await recordAudit({
    actorId: user.id,
    action: 'cleanup.updated',
    entityType: 'cleanup',
    entityId: id,
    metadata: { photo: phase },
  });
  return saved;
}
