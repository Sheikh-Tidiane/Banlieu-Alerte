import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db';
import { cellInputs, drainPressure, type CellForRisk } from '@/lib/risk/inputs';
import { computeRisk, mostExposed } from '@/lib/risk/score';
import { HORIZONS, type Horizon, type RiskResult } from '@/lib/risk/types';
import { rainInputs } from '@/lib/weather/aggregate';
import { createWeatherProvider, type HourlyRain, type WeatherProvider } from '@/lib/weather';
import { createRiskDrafts } from '@/services/alerts/auto-draft';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { getActiveRules } from './rules';

// Tâche de recalcul de l'indice (D-048) : météo → cellules → quartiers → brouillons.
// Chaque exécution est conservée (RiskRun, RiskPrediction) pour l'évaluation (CDC §6).

/** Fenêtre des signalements de caniveaux et dépôts pris en compte (D-046). */
export const DRAIN_REPORT_DAYS = 30;

export type RefreshOptions = {
  provider?: WeatherProvider;
  /** Météo injectée : le relevé et les prédictions sont marqués « démo ». */
  injectedWeather?: boolean;
  trigger: 'cron' | 'admin' | 'script' | 'test' | 'demo';
  actorId?: string | null;
  now?: Date;
  /** Faux : calcul sans brouillon d'alerte (aperçus et captures des tests). */
  drafts?: boolean;
};

export type RefreshResult = {
  runId: string;
  weather: { status: 'fresh' | 'stale' | 'missing'; fetchedAt: Date | null; source: string | null };
  cells: number;
  neighborhoods: number;
  draftsCreated: number;
};

type Snapshot = {
  id: string;
  hourly: HourlyRain;
  fetchedAt: Date;
  source: string;
  isDemo: boolean;
};

function centerOf(cells: CellForRisk[]) {
  const lats = cells.map((c) => c.lat);
  const lngs = cells.map((c) => c.lng);
  return {
    lat: Math.round(((Math.min(...lats) + Math.max(...lats)) / 2) * 1e4) / 1e4,
    lng: Math.round(((Math.min(...lngs) + Math.max(...lngs)) / 2) * 1e4) / 1e4,
  };
}

/** Relevé du moment ; en cas de panne, le dernier relevé enregistré (EXG-09). */
async function obtainWeather(
  provider: WeatherProvider,
  point: { lat: number; lng: number },
  injected: boolean,
): Promise<{ snapshot: Snapshot | null; stale: boolean }> {
  const prisma = getPrisma();
  try {
    const forecast = await provider.fetchForecast(point);
    const saved = await prisma.weatherSnapshot.create({
      data: {
        lat: point.lat,
        lng: point.lng,
        source: forecast.source,
        hourly: forecast.hourly,
        isDemo: injected,
      },
      select: { id: true, fetchedAt: true },
    });
    return {
      snapshot: { ...saved, hourly: forecast.hourly, source: forecast.source, isDemo: injected },
      stale: false,
    };
  } catch (error) {
    await prisma.errorLog.create({
      data: {
        source: 'weather',
        message: error instanceof Error ? error.message : 'Erreur météo inconnue',
        context: { provider: provider.name },
      },
    });
    // Une météo injectée (démo) n'est jamais reprise pour un calcul réel, et inversement.
    const last = await prisma.weatherSnapshot.findFirst({
      where: { isDemo: injected },
      orderBy: { fetchedAt: 'desc' },
      select: { id: true, hourly: true, fetchedAt: true, source: true, isDemo: true },
    });
    if (!last) return { snapshot: null, stale: true };
    return { snapshot: { ...last, hourly: last.hourly as HourlyRain }, stale: true };
  }
}

function toFactorsJson(result: RiskResult, extra: Record<string, unknown> = {}) {
  return {
    factors: result.factors,
    topFactors: result.topFactors,
    missing: result.missing,
    cappedWithoutRain: result.cappedWithoutRain,
    ...extra,
  } as Prisma.InputJsonObject;
}

export async function refreshRisk(options: RefreshOptions): Promise<RefreshResult> {
  const prisma = getPrisma();
  const now = options.now ?? new Date();
  const rules = await getActiveRules();

  const cellRows = await prisma.riskCell.findMany({
    select: {
      id: true,
      row: true,
      col: true,
      centerLat: true,
      centerLng: true,
      sizeMeters: true,
      relativeElevation: true,
      slopePercent: true,
      neighborhoodId: true,
      isDemo: true,
    },
  });
  if (cellRows.length === 0) {
    throw new ServiceError('CONFLICT', 'Aucune cellule : lancez `npm run risk:cells`.');
  }
  const cells = cellRows.map((c) => ({
    id: c.id,
    row: c.row,
    col: c.col,
    lat: Number(c.centerLat),
    lng: Number(c.centerLng),
    sizeMeters: c.sizeMeters,
    relativeElevation: c.relativeElevation === null ? null : Number(c.relativeElevation),
    slopePercent: c.slopePercent === null ? null : Number(c.slopePercent),
    neighborhoodId: c.neighborhoodId,
    isDemo: c.isDemo,
  }));

  const { snapshot, stale } = await obtainWeather(
    options.provider ?? createWeatherProvider(),
    centerOf(cells),
    options.injectedWeather ?? false,
  );

  // Caniveaux et dépôts signalés récemment, hors rejetés et doublons fusionnés.
  const reports = await prisma.report.findMany({
    where: {
      type: { in: ['BLOCKED_DRAIN', 'WASTE_DUMP'] },
      status: { not: 'REJECTED' },
      duplicateOfId: null,
      createdAt: { gte: new Date(now.getTime() - DRAIN_REPORT_DAYS * 86_400_000) },
    },
    select: { lat: true, lng: true, severity: true, isDemo: true },
  });
  const drainReports = reports.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    severity: r.severity,
  }));
  const pressure = drainPressure(cells, drainReports);
  const demoPressure = drainPressure(
    cells,
    drainReports.filter((_, i) => reports[i]?.isDemo),
  );

  const weatherDemo = snapshot?.isDemo ?? false;
  const run = await prisma.riskRun.create({
    data: {
      ruleVersionId: rules.id,
      weatherSnapshotId: snapshot?.id ?? null,
      weatherStale: stale,
      cellCount: cells.length,
      trigger: options.trigger,
      isDemo: weatherDemo || cells.some((c) => c.isDemo),
    },
    select: { id: true },
  });

  const neighborhoodPredictions: {
    id: string;
    neighborhoodId: string;
    horizon: Horizon;
    result: RiskResult;
  }[] = [];

  for (const horizon of HORIZONS) {
    const rain = snapshot
      ? rainInputs(snapshot.hourly, now, horizon)
      : { rainWindow: null, rain6hMax: null, saturation: null };

    const results = cells.map((cell) => ({
      cell,
      result: computeRisk(cellInputs(cell, rain, pressure.get(cell.id) ?? 0), rules.params),
      isDemo: weatherDemo || cell.isDemo || (demoPressure.get(cell.id) ?? 0) > 0,
    }));

    await prisma.riskPrediction.createMany({
      data: results.map(({ cell, result, isDemo }) => ({
        runId: run.id,
        scope: 'CELL' as const,
        cellId: cell.id,
        neighborhoodId: cell.neighborhoodId,
        horizonHours: horizon,
        score: result.score,
        level: result.level,
        factors: toFactorsJson(result),
        ruleVersionId: rules.id,
        weatherFetchedAt: snapshot?.fetchedAt ?? null,
        isDemo,
      })),
    });

    // Agrégation par quartier : sa cellule la plus exposée (D-047).
    const byNeighborhood = new Map<string, typeof results>();
    for (const item of results) {
      if (!item.cell.neighborhoodId) continue;
      const list = byNeighborhood.get(item.cell.neighborhoodId) ?? [];
      list.push(item);
      byNeighborhood.set(item.cell.neighborhoodId, list);
    }
    for (const [neighborhoodId, items] of byNeighborhood) {
      const top = mostExposed(items);
      if (!top) continue;
      const levelCounts = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0, LIMITED: 0 };
      for (const item of items) levelCounts[item.result.level ?? 'LIMITED'] += 1;
      const created = await prisma.riskPrediction.create({
        data: {
          runId: run.id,
          scope: 'NEIGHBORHOOD',
          neighborhoodId,
          cellId: top.cell.id,
          horizonHours: horizon,
          score: top.result.score,
          level: top.result.level,
          factors: toFactorsJson(top.result, { cellCount: items.length, levelCounts }),
          ruleVersionId: rules.id,
          weatherFetchedAt: snapshot?.fetchedAt ?? null,
          isDemo: items.some((i) => i.isDemo),
        },
        select: { id: true },
      });
      neighborhoodPredictions.push({ id: created.id, neighborhoodId, horizon, result: top.result });
    }
  }

  // Brouillons d'alerte indicative (jamais envoyés sans approbation, EXG-29).
  const draftsCreated =
    options.drafts === false
      ? 0
      : await createRiskDrafts(
          neighborhoodPredictions.filter((p) => p.horizon === 24),
          { isDemo: weatherDemo, now },
        );
  await prisma.riskRun.update({ where: { id: run.id }, data: { draftsCreated } });

  await recordAudit({
    actorId: options.actorId ?? null,
    action: 'risk.refreshed',
    entityType: 'risk_run',
    entityId: run.id,
    metadata: {
      trigger: options.trigger,
      ruleVersion: rules.number,
      weather: snapshot ? (stale ? 'stale' : 'fresh') : 'missing',
      draftsCreated,
    },
  });

  return {
    runId: run.id,
    weather: {
      status: snapshot ? (stale ? 'stale' : 'fresh') : 'missing',
      fetchedAt: snapshot?.fetchedAt ?? null,
      source: snapshot?.source ?? null,
    },
    cells: cells.length,
    neighborhoods: new Set(neighborhoodPredictions.map((p) => p.neighborhoodId)).size,
    draftsCreated,
  };
}
