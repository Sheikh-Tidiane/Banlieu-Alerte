import { getPrisma } from '@/lib/db';
import {
  computeMetrics,
  MODELS,
  modelPredictsFlood,
  QUALITY_THRESHOLD,
  thresholdReached,
  type Metrics,
  type ModelCode,
} from '@/lib/risk/evaluation';
import type { FactorResult } from '@/lib/risk/types';
import { ruleParamsSchema } from '@/validators/risk';

// Qualité de l'indice (EXG-12, D-054). Aucune métrique n'est calculée sous le seuil ; les
// données de démonstration (épisodes, étiquettes, prédictions) sont toujours exclues.

export type IndexQuality = {
  threshold: typeof QUALITY_THRESHOLD;
  counts: { episodes: number; labels: number; flooded: number };
  reached: boolean;
  /** Présent seulement si le seuil est atteint. */
  results: {
    samples: number;
    /** Étiquettes sans prédiction antérieure à l'épisode (exclues). */
    withoutPrediction: number;
    models: Record<ModelCode, Metrics>;
  } | null;
};

export async function getIndexQuality(): Promise<IndexQuality> {
  const prisma = getPrisma();
  const labelWhere = {
    isDemo: false,
    label: { in: ['FLOODED', 'NOT_FLOODED'] as ('FLOODED' | 'NOT_FLOODED')[] },
    episode: { status: 'VALIDATED' as const, isDemo: false },
  };
  const [episodes, labels, flooded] = await Promise.all([
    prisma.rainEpisode.count({ where: { status: 'VALIDATED', isDemo: false } }),
    prisma.episodeLabel.count({ where: labelWhere }),
    prisma.episodeLabel.count({ where: { ...labelWhere, label: { in: ['FLOODED'] } } }),
  ]);
  const counts = { episodes, labels, flooded };
  if (!thresholdReached(counts)) {
    return { threshold: QUALITY_THRESHOLD, counts, reached: false, results: null };
  }

  const rows = await prisma.episodeLabel.findMany({
    where: labelWhere,
    select: { label: true, cellId: true, episode: { select: { startsAt: true } } },
  });
  const samples: Record<ModelCode, { flooded: boolean; predicted: boolean }[]> = {
    M0: [],
    M1: [],
    M2: [],
  };
  let withoutPrediction = 0;
  for (const row of rows) {
    // Protocole (D-054) : dernière prédiction réelle à 24 h, antérieure au début de l'épisode.
    const prediction = await prisma.riskPrediction.findFirst({
      where: {
        cellId: row.cellId,
        scope: 'CELL',
        horizonHours: 24,
        isDemo: false,
        createdAt: { lt: row.episode.startsAt },
      },
      orderBy: { createdAt: 'desc' },
      select: { factors: true, ruleVersion: { select: { params: true } } },
    });
    const params = prediction ? ruleParamsSchema.safeParse(prediction.ruleVersion.params) : null;
    if (!prediction || !params?.success) {
      withoutPrediction += 1;
      continue;
    }
    const factors = (prediction.factors as { factors: FactorResult[] }).factors;
    for (const model of MODELS) {
      samples[model].push({
        flooded: row.label === 'FLOODED',
        predicted: modelPredictsFlood(factors, params.data, model),
      });
    }
  }
  return {
    threshold: QUALITY_THRESHOLD,
    counts,
    reached: true,
    results: {
      samples: samples.M0.length,
      withoutPrediction,
      models: {
        M0: computeMetrics(samples.M0),
        M1: computeMetrics(samples.M1),
        M2: computeMetrics(samples.M2),
      },
    },
  };
}
