// Indice de risque v1 (CDC §5) : score de 0 à 100 par règles pondérées. Ce n'est pas une
// probabilité (CDC §5). Types partagés par le moteur, les services et l'interface.

export const FACTOR_KEYS = [
  'rain24h',
  'rain6hMax',
  'saturation',
  'lowArea',
  'slope',
  'drainReports',
  'history',
] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
export type RiskLevelCode = (typeof RISK_LEVELS)[number];

export const HORIZONS = [24, 48] as const;
export type Horizon = (typeof HORIZONS)[number];

/**
 * Règle d'un facteur. Les trois bornes donnent les paliers 1, 2 et 3 (le palier 0 rapporte
 * 0 point, le palier 3 tous les points) :
 * - `higher` : palier n si la valeur est ≥ borne n (pluie, signalements) ;
 * - `lower` : palier n si la valeur est < borne n (altitude relative, pente).
 */
export type FactorRule = {
  maxPoints: number;
  direction: 'higher' | 'lower';
  thresholds: [number, number, number];
};

export type RuleParams = {
  factors: Record<FactorKey, FactorRule>;
  /** Bornes basses incluses des niveaux Modéré, Élevé et Critique. */
  levels: { moderate: number; high: number; critical: number };
  /**
   * Score maximum par temps sec : palier 0 pour la pluie prévue, le pic sur 6 h et la
   * saturation. Null : pas de plafond. D-052.
   */
  noRainMaxScore: number | null;
};

/** Données d'entrée d'une cellule pour un horizon. `null` = donnée absente. */
export type FactorInputs = Record<FactorKey, number | null>;

export type FactorResult = {
  key: FactorKey;
  /** Valeur mesurée (mm, m, %, points de signalement…) ; null si absente. */
  value: number | null;
  tier: 0 | 1 | 2 | 3;
  points: number;
  maxPoints: number;
  missing: boolean;
};

export type RiskResult = {
  /** Null si les données sont insuffisantes (« données limitées », CDC §5.4). */
  score: number | null;
  level: RiskLevelCode | null;
  factors: FactorResult[];
  /** Trois facteurs principaux (points les plus élevés, non nuls). */
  topFactors: FactorKey[];
  missing: FactorKey[];
  /** Vrai si le plafond sans pluie a été appliqué. */
  cappedWithoutRain: boolean;
};
