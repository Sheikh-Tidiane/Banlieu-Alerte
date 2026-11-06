import {
  FACTOR_KEYS,
  type FactorInputs,
  type FactorKey,
  type FactorResult,
  type FactorRule,
  type RiskLevelCode,
  type RiskResult,
  type RuleParams,
} from './types';

// Moteur de l'indice v1 : déterministe, sans base ni réseau (CDC §5.3).

/** Sans prévision de pluie, l'indice n'a pas de sens : « données limitées ». */
const REQUIRED_FOR_SCORE: FactorKey[] = ['rain24h'];
/** Facteurs d'eau : pluie prévue et sol saturé par la pluie passée. */
const WATER_FACTORS: FactorKey[] = ['rain24h', 'rain6hMax', 'saturation'];

export function factorTier(value: number, rule: FactorRule): 0 | 1 | 2 | 3 {
  const reached = rule.thresholds.filter((bound) =>
    rule.direction === 'higher' ? value >= bound : value < bound,
  ).length;
  return reached as 0 | 1 | 2 | 3;
}

export function scoreFactor(key: FactorKey, value: number | null, rule: FactorRule): FactorResult {
  if (value === null || !Number.isFinite(value)) {
    return { key, value: null, tier: 0, points: 0, maxPoints: rule.maxPoints, missing: true };
  }
  const tier = factorTier(value, rule);
  return {
    key,
    value,
    tier,
    points: (rule.maxPoints * tier) / 3,
    maxPoints: rule.maxPoints,
    missing: false,
  };
}

export function levelFor(score: number, levels: RuleParams['levels']): RiskLevelCode {
  if (score >= levels.critical) return 'CRITICAL';
  if (score >= levels.high) return 'HIGH';
  if (score >= levels.moderate) return 'MODERATE';
  return 'LOW';
}

export function computeRisk(inputs: FactorInputs, params: RuleParams): RiskResult {
  const factors = FACTOR_KEYS.map((key) => scoreFactor(key, inputs[key], params.factors[key]));
  const missing = factors.filter((f) => f.missing).map((f) => f.key);
  const topFactors = factors
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points || FACTOR_KEYS.indexOf(a.key) - FACTOR_KEYS.indexOf(b.key))
    .slice(0, 3)
    .map((f) => f.key);

  if (REQUIRED_FOR_SCORE.some((key) => missing.includes(key))) {
    return { score: null, level: null, factors, topFactors, missing, cappedWithoutRain: false };
  }
  const raw = Math.round(factors.reduce((sum, f) => sum + f.points, 0));
  // Plafond sans pluie (D-052) : le terrain et les caniveaux seuls ne font pas une alerte.
  // Temps sec : ni pluie prévue, ni sol saturé (un sol gorgé d'eau n'est pas plafonné).
  const dry = factors.every((f) => !WATER_FACTORS.includes(f.key) || f.tier === 0);
  const cap = params.noRainMaxScore;
  const cappedWithoutRain = dry && cap !== null && raw > cap;
  const score = cappedWithoutRain ? cap : raw;
  return {
    score,
    level: levelFor(score, params.levels),
    factors,
    topFactors,
    missing,
    cappedWithoutRain,
  };
}

const LEVEL_ORDER: Record<RiskLevelCode, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

export const compareLevels = (a: RiskLevelCode, b: RiskLevelCode) =>
  LEVEL_ORDER[a] - LEVEL_ORDER[b];

/** Agrégation d'un quartier : sa cellule la plus exposée (D-047). */
export function mostExposed<T extends { result: RiskResult }>(cells: T[]): T | null {
  let best: T | null = null;
  for (const cell of cells) {
    if (cell.result.score === null) continue;
    if (!best || cell.result.score > (best.result.score ?? -1)) best = cell;
  }
  return best ?? cells[0] ?? null;
}
