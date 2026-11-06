import { getPrisma } from '@/lib/db';
import { describeFactor } from '@/lib/risk/explain';
import type { FactorKey, FactorResult, Horizon, RiskLevelCode } from '@/lib/risk/types';
import { rainOutlook } from '@/lib/weather/aggregate';
import type { HourlyRain } from '@/lib/weather';

// Lecture publique de l'indice (EXG-08) : chaque score porte ses trois facteurs principaux,
// la date des données météo, l'horizon et les données absentes. Aucune donnée personnelle.

/** Au-delà, un relevé est présenté comme ancien même si la tâche ne l'a pas signalé. */
export const WEATHER_STALE_AFTER_HOURS = 6;

type StoredFactors = {
  factors: FactorResult[];
  topFactors: FactorKey[];
  missing: FactorKey[];
  cappedWithoutRain?: boolean;
  cellCount?: number;
};

export type PublicRisk = {
  neighborhoodId: string;
  neighborhoodName: string;
  horizonHours: Horizon;
  score: number | null;
  level: RiskLevelCode | null;
  topFactors: { key: FactorKey; text: string; points: number; maxPoints: number }[];
  missing: FactorKey[];
  cappedWithoutRain: boolean;
  cellCount: number;
  isDemo: boolean;
};

export type RiskOverview = {
  computedAt: string;
  ruleVersion: { number: number; name: string };
  weather: {
    fetchedAt: string | null;
    source: string | null;
    /** Relevé ancien ou repris après une panne (EXG-09). */
    stale: boolean;
    /** Météo injectée (démonstration) : jamais présentée comme réelle. */
    isDemo: boolean;
  };
  outlook: { start: string; mm: number | null }[];
  neighborhoods: Record<Horizon, PublicRisk[]>;
  isDemo: boolean;
};

function toPublicRisk(row: {
  neighborhoodId: string | null;
  neighborhood: { name: string } | null;
  horizonHours: number;
  score: number | null;
  level: RiskLevelCode | null;
  factors: unknown;
  isDemo: boolean;
}): PublicRisk {
  const stored = row.factors as StoredFactors;
  return {
    neighborhoodId: row.neighborhoodId ?? '',
    neighborhoodName: row.neighborhood?.name ?? '',
    horizonHours: row.horizonHours as Horizon,
    score: row.score,
    level: row.level,
    topFactors: stored.topFactors
      .map((key) => stored.factors.find((f) => f.key === key))
      .filter((f): f is FactorResult => Boolean(f))
      .map((f) => ({
        key: f.key,
        text: describeFactor(f),
        points: Math.round(f.points),
        maxPoints: f.maxPoints,
      })),
    missing: stored.missing,
    cappedWithoutRain: stored.cappedWithoutRain ?? false,
    cellCount: stored.cellCount ?? 1,
    isDemo: row.isDemo,
  };
}

const LEVEL_RANK: Record<RiskLevelCode, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

/** Dernière exécution de la tâche ; null tant qu'aucun indice n'a été calculé. */
export async function getRiskOverview(now = new Date()): Promise<RiskOverview | null> {
  const prisma = getPrisma();
  const run = await prisma.riskRun.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      weatherStale: true,
      isDemo: true,
      ruleVersion: { select: { number: true, name: true } },
      weatherSnapshot: { select: { fetchedAt: true, source: true, hourly: true, isDemo: true } },
      predictions: {
        where: { scope: 'NEIGHBORHOOD' },
        select: {
          neighborhoodId: true,
          neighborhood: { select: { name: true } },
          horizonHours: true,
          score: true,
          level: true,
          factors: true,
          isDemo: true,
        },
      },
    },
  });
  if (!run) return null;

  const snapshot = run.weatherSnapshot;
  const old =
    snapshot !== null &&
    now.getTime() - snapshot.fetchedAt.getTime() > WEATHER_STALE_AFTER_HOURS * 3_600_000;
  const byHorizon = (horizon: Horizon) =>
    run.predictions
      .filter((p) => p.horizonHours === horizon)
      .map(toPublicRisk)
      // Les plus exposés d'abord, puis par nom.
      .sort(
        (a, b) =>
          (b.level ? LEVEL_RANK[b.level] : -1) - (a.level ? LEVEL_RANK[a.level] : -1) ||
          (b.score ?? -1) - (a.score ?? -1) ||
          a.neighborhoodName.localeCompare(b.neighborhoodName, 'fr'),
      );

  return {
    computedAt: run.createdAt.toISOString(),
    ruleVersion: run.ruleVersion,
    weather: {
      fetchedAt: snapshot?.fetchedAt.toISOString() ?? null,
      source: snapshot?.source ?? null,
      stale: run.weatherStale || old,
      isDemo: snapshot?.isDemo ?? false,
    },
    outlook: snapshot ? rainOutlook(snapshot.hourly as HourlyRain, now) : [],
    neighborhoods: { 24: byHorizon(24), 48: byHorizon(48) },
    isDemo: run.isDemo,
  };
}

/** Indice d'un quartier (dernière exécution), pour `GET /api/neighborhoods/:id/risk`. */
export async function getNeighborhoodRisk(neighborhoodId: string) {
  const overview = await getRiskOverview();
  if (!overview) return null;
  const find = (h: Horizon) =>
    overview.neighborhoods[h].find((n) => n.neighborhoodId === neighborhoodId) ?? null;
  const h24 = find(24);
  const h48 = find(48);
  if (!h24 && !h48) return null;
  return {
    computedAt: overview.computedAt,
    weather: overview.weather,
    ruleVersion: overview.ruleVersion,
    horizons: { 24: h24, 48: h48 },
  };
}

/** Détail d'une cellule : tous ses facteurs, pour `GET /api/risk/cells/:id/factors`. */
export async function getCellFactors(cellId: string) {
  const rows = await getPrisma().riskPrediction.findMany({
    where: { cellId, scope: 'CELL' },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: {
      horizonHours: true,
      score: true,
      level: true,
      factors: true,
      weatherFetchedAt: true,
      isDemo: true,
      createdAt: true,
      ruleVersion: { select: { number: true } },
      cell: {
        select: {
          row: true,
          col: true,
          centerLat: true,
          centerLng: true,
          sizeMeters: true,
          elevationSource: true,
        },
      },
    },
  });
  const first = rows[0];
  if (!first?.cell) return null;
  return {
    cell: {
      id: cellId,
      lat: Number(first.cell.centerLat),
      lng: Number(first.cell.centerLng),
      sizeMeters: first.cell.sizeMeters,
      elevationSource: first.cell.elevationSource,
    },
    computedAt: first.createdAt.toISOString(),
    ruleVersion: first.ruleVersion.number,
    weatherFetchedAt: first.weatherFetchedAt?.toISOString() ?? null,
    horizons: rows.map((row) => {
      const stored = row.factors as StoredFactors;
      return {
        horizonHours: row.horizonHours,
        score: row.score,
        level: row.level,
        factors: stored.factors.map((f) => ({
          ...f,
          points: Math.round(f.points * 10) / 10,
          text: describeFactor(f),
        })),
        topFactors: stored.topFactors,
        missing: stored.missing,
        cappedWithoutRain: stored.cappedWithoutRain ?? false,
        isDemo: row.isDemo,
      };
    }),
  };
}

export type PublicRiskCell = {
  id: string;
  lat: number;
  lng: number;
  sizeMeters: number;
  score: number | null;
  level: RiskLevelCode | null;
  /** Trois facteurs principaux, en langage simple. */
  factors: string[];
  cappedWithoutRain: boolean;
  isDemo: boolean;
};

/** Cases de la dernière exécution pour un horizon (carte de risque, D-060). Aucune donnée personnelle. */
export async function getRiskCells(horizon: Horizon) {
  const run = await getPrisma().riskRun.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      weatherStale: true,
      isDemo: true,
      weatherSnapshot: { select: { fetchedAt: true, source: true, isDemo: true } },
    },
  });
  if (!run) return null;
  const rows = await getPrisma().riskPrediction.findMany({
    where: { runId: run.id, scope: 'CELL', horizonHours: horizon },
    select: {
      score: true,
      level: true,
      factors: true,
      isDemo: true,
      cell: { select: { id: true, centerLat: true, centerLng: true, sizeMeters: true } },
    },
  });
  const cells: PublicRiskCell[] = rows
    .filter((row) => row.cell)
    .map((row) => {
      const stored = row.factors as StoredFactors;
      return {
        id: row.cell!.id,
        lat: Number(row.cell!.centerLat),
        lng: Number(row.cell!.centerLng),
        sizeMeters: row.cell!.sizeMeters,
        score: row.score,
        level: row.level,
        factors: stored.topFactors
          .map((key) => stored.factors.find((f) => f.key === key))
          .filter((f): f is FactorResult => Boolean(f))
          .map((f) => describeFactor(f)),
        cappedWithoutRain: stored.cappedWithoutRain ?? false,
        isDemo: row.isDemo,
      };
    });
  return {
    horizonHours: horizon,
    computedAt: run.createdAt.toISOString(),
    weather: {
      fetchedAt: run.weatherSnapshot?.fetchedAt.toISOString() ?? null,
      source: run.weatherSnapshot?.source ?? null,
      stale: run.weatherStale,
      isDemo: run.weatherSnapshot?.isDemo ?? false,
    },
    isDemo: run.isDemo,
    cells,
  };
}

export type RiskCellsData = NonNullable<Awaited<ReturnType<typeof getRiskCells>>>;
