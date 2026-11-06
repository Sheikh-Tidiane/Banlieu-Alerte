import { getPrisma } from '@/lib/db';
import { FixtureWeatherProvider } from '@/lib/weather/open-meteo';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { generateTrackingCode } from '@/services/reports/tracking-code';
import { refreshRisk } from '@/services/risk/refresh';

// Simulateur d'épisode de pluie (CDC §4.4, D-063) : désactivé par défaut (DEMO_MODE).
// Tout ce qu'il produit est marqué « démo » et rattaché à une exécution de déclencheur
// `demo`, pour être supprimé précisément. Les alertes restent des brouillons : leur
// approbation humaine fait partie de la démonstration (CDC §1.3).

export const isDemoMode = () => process.env.DEMO_MODE === 'true';

/** Pluie fictive : 2 mm/h les 3 jours passés, 6 mm/h les 24 prochaines heures, 3 mm/h ensuite. */
export const demoRain = (hourFromNow: number) =>
  hourFromNow < 0 ? 2 : hourFromNow < 24 ? 6 : hourFromNow < 48 ? 3 : 0;

const SIMULATED_REPORTS = [
  { type: 'FLOODING', severity: 'HIGH' },
  { type: 'FLOODING', severity: 'HIGH' },
  { type: 'FLOODING', severity: 'MEDIUM' },
  { type: 'BLOCKED_DRAIN', severity: 'HIGH' },
  { type: 'BLOCKED_DRAIN', severity: 'MEDIUM' },
  { type: 'ROAD_CUT', severity: 'HIGH' },
  { type: 'WASTE_DUMP', severity: 'MEDIUM' },
  { type: 'FLOODING', severity: 'LOW' },
] as const;

function requireDemo(user: AuthUser) {
  if (!isDemoMode()) throw new ServiceError('NOT_FOUND', 'Mode démonstration désactivé.');
  if (user.role !== 'ADMIN') throw new ServiceError('FORBIDDEN', 'Réservé aux administrateurs.');
}

export async function simulateRain(user: AuthUser, now = new Date()) {
  requireDemo(user);
  const prisma = getPrisma();
  const result = await refreshRisk({
    provider: new FixtureWeatherProvider(demoRain, () => now),
    injectedWeather: true,
    trigger: 'demo',
    actorId: user.id,
    now,
  });

  // Signalements simulés dans les cases les plus exposées (de préférence rattachées à un quartier).
  const exposed = await prisma.riskPrediction.findMany({
    where: { runId: result.runId, scope: 'CELL', horizonHours: 24 },
    orderBy: [{ score: 'desc' }],
    take: 40,
    select: {
      cell: {
        select: { centerLat: true, centerLng: true, sizeMeters: true, neighborhoodId: true },
      },
    },
  });
  const cells = exposed
    .map((p) => p.cell!)
    .sort((a, b) => Number(Boolean(b.neighborhoodId)) - Number(Boolean(a.neighborhoodId)));

  let reports = 0;
  for (const [i, spec] of SIMULATED_REPORTS.entries()) {
    const cell = cells[i % Math.max(1, cells.length)];
    if (!cell) break;
    // Décalage déterministe dans la case (moins d'un tiers de sa taille).
    const offset = ((i % 3) - 1) * (cell.sizeMeters / 3 / 111_320);
    const createdAt = new Date(now.getTime() - (SIMULATED_REPORTS.length - i) * 4 * 60_000);
    await prisma.report.create({
      data: {
        trackingCode: generateTrackingCode(),
        type: spec.type,
        severity: spec.severity,
        description: 'Démonstration : signalement simulé pendant un épisode de pluie fictif.',
        lat: Number(cell.centerLat) + offset,
        lng: Number(cell.centerLng) - offset,
        neighborhoodId: cell.neighborhoodId,
        attachment: cell.neighborhoodId ? 'AUTOMATIC' : 'UNIDENTIFIED',
        isDemo: true,
        simulationRunId: result.runId,
        createdAt,
        statusHistory: { create: { fromStatus: null, toStatus: 'NEW', createdAt } },
      },
    });
    reports += 1;
  }

  await recordAudit({
    actorId: user.id,
    action: 'demo.simulated',
    entityType: 'risk_run',
    entityId: result.runId,
    metadata: { reports, draftsCreated: result.draftsCreated },
  });
  return { runId: result.runId, reports, draftsCreated: result.draftsCreated };
}

/** Supprime ce que le simulateur a produit, et seulement cela. */
export async function resetDemo(user: AuthUser) {
  requireDemo(user);
  const prisma = getPrisma();
  const runs = await prisma.riskRun.findMany({ where: { trigger: 'demo' }, select: { id: true } });
  const runIds = runs.map((r) => r.id);
  const counts = await prisma.$transaction(async (tx) => {
    const alerts = await tx.alert.deleteMany({
      where: { isDemo: true, riskPrediction: { runId: { in: runIds } } },
    });
    const reports = await tx.report.deleteMany({
      where: { isDemo: true, simulationRunId: { in: runIds } },
    });
    const deletedRuns = await tx.riskRun.deleteMany({ where: { id: { in: runIds } } });
    await tx.weatherSnapshot.deleteMany({ where: { isDemo: true, runs: { none: {} } } });
    return { alerts: alerts.count, reports: reports.count, runs: deletedRuns.count };
  });
  await recordAudit({
    actorId: user.id,
    action: 'demo.reset',
    entityType: 'risk_run',
    metadata: counts,
  });
  return counts;
}
