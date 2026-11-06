import type { FactorKey, FactorResult, RuleParams } from './types';

// Évaluation de l'indice contre les étiquettes validées (CDC §6, D-054). Code pur.
// Le protocole est fixé AVANT tout résultat ; le modifier exige une décision consignée.

/** Seuil minimal avant tout affichage (choix de l'équipe, D-054). */
export const QUALITY_THRESHOLD = { episodes: 5, labels: 30, flooded: 5 } as const;

export const MODELS = ['M0', 'M1', 'M2'] as const;
export type ModelCode = (typeof MODELS)[number];

/** Facteurs de chaque modèle comparé (CDC §6). */
export const MODEL_FACTORS: Record<ModelCode, FactorKey[]> = {
  M0: ['rain24h', 'rain6hMax', 'saturation'],
  M1: ['rain24h', 'rain6hMax', 'saturation', 'lowArea', 'slope'],
  M2: ['rain24h', 'rain6hMax', 'saturation', 'lowArea', 'slope', 'drainReports'],
};

export type Counts = { episodes: number; labels: number; flooded: number };

export function thresholdReached(counts: Counts): boolean {
  return (
    counts.episodes >= QUALITY_THRESHOLD.episodes &&
    counts.labels >= QUALITY_THRESHOLD.labels &&
    counts.flooded >= QUALITY_THRESHOLD.flooded
  );
}

/**
 * Prévision « inondé » d'un modèle : part des points obtenus sur ses facteurs, ramenée sur
 * 100, au moins égale au seuil « Élevé » de la grille utilisée pour la prédiction.
 * Le plafond par temps sec s'applique aussi (même règle que l'indice publié).
 */
export function modelPredictsFlood(
  factors: FactorResult[],
  params: RuleParams,
  model: ModelCode,
): boolean {
  const keys = MODEL_FACTORS[model];
  const used = factors.filter((f) => keys.includes(f.key));
  const max = keys.reduce((sum, key) => sum + params.factors[key].maxPoints, 0);
  if (max === 0) return false;
  let score = (used.reduce((sum, f) => sum + f.points, 0) / max) * 100;
  const dry = factors
    .filter((f) => ['rain24h', 'rain6hMax', 'saturation'].includes(f.key))
    .every((f) => f.tier === 0);
  if (dry && params.noRainMaxScore !== null) score = Math.min(score, params.noRainMaxScore);
  return score >= params.levels.high;
}

export type Interval = { value: number; low: number; high: number };

/** Intervalle de Wilson à 95 % ; null si aucun cas. */
export function wilson(successes: number, total: number, z = 1.96): Interval | null {
  if (total === 0) return null;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    value: round(p),
    low: round(Math.max(0, center - margin)),
    high: round(Math.min(1, center + margin)),
  };
}

export type Sample = { flooded: boolean; predicted: boolean };

export type Metrics = {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  /** Part des prévisions « inondé » qui l'étaient vraiment. */
  precision: Interval | null;
  /** Part des cases inondées que l'indice avait prévues (H1). */
  recall: Interval | null;
  /** Taux de fausses alertes : part des prévisions « inondé » démenties (FAR). */
  falseAlarmRatio: Interval | null;
};

export function computeMetrics(samples: Sample[]): Metrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const s of samples) {
    if (s.predicted && s.flooded) tp++;
    else if (s.predicted) fp++;
    else if (s.flooded) fn++;
    else tn++;
  }
  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    trueNegatives: tn,
    precision: wilson(tp, tp + fp),
    recall: wilson(tp, tp + fn),
    falseAlarmRatio: wilson(fp, tp + fp),
  };
}
