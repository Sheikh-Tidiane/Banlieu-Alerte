import type { RuleParams } from './types';

/**
 * Grille v1 (D-046) : HYPOTHÈSE DE DÉPART, à valider avec des délégués ou un expert
 * (ANACIM, service technique). Réglable et versionnée depuis le back-office (EXG-42).
 */
export const DEFAULT_RULE_PARAMS: RuleParams = {
  factors: {
    // Cumul de pluie prévu sur la fenêtre de l'horizon (mm).
    rain24h: { maxPoints: 30, direction: 'higher', thresholds: [1, 10, 30] },
    // Plus forte pluie sur 6 h consécutives dans la fenêtre (mm).
    rain6hMax: { maxPoints: 15, direction: 'higher', thresholds: [1, 5, 15] },
    // Pluie des 72 h précédentes (mm).
    saturation: { maxPoints: 10, direction: 'higher', thresholds: [5, 20, 50] },
    // Altitude relative aux voisines (m) : plus elle est basse, plus l'eau s'accumule.
    lowArea: { maxPoints: 20, direction: 'lower', thresholds: [0, -0.5, -1.5] },
    // Pente (%) : une pente faible favorise la stagnation.
    slope: { maxPoints: 5, direction: 'lower', thresholds: [2, 1, 0.5] },
    // Signalements de caniveaux et dépôts (pondérés par la gravité).
    drainReports: { maxPoints: 15, direction: 'higher', thresholds: [1, 3, 6] },
    // Inondations validées dans la cellule (étiquettes, Phase 5).
    history: { maxPoints: 5, direction: 'higher', thresholds: [1, 2, 3] },
  },
  levels: { moderate: 25, high: 50, critical: 75 },
  // Sans pluie prévue, le niveau reste « Faible » (D-052) ; la vulnérabilité reste affichée.
  noRainMaxScore: 24,
};

export const DEFAULT_RULE_NAME = 'Grille v1 – hypothèse de départ (CDC §5.3)';
