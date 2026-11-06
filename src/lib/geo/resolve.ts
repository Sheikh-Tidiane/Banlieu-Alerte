import { distanceMeters, type LatLng } from './distance';

// Rattachement d'une position aux quartiers (CDC §4.5, D-026). Code pur, sans base.

export type Landmark = LatLng & {
  neighborhoodId: string;
  neighborhoodName: string;
  radiusMeters: number;
};

export type Candidate = {
  neighborhoodId: string;
  neighborhoodName: string;
  /** Distance au repère le plus proche du quartier, en mètres. */
  distanceMeters: number;
  /** Distance rapportée au rayon du repère : 1 = sur le bord du rayon. */
  ratio: number;
};

export type Resolution =
  | { status: 'automatic'; best: Candidate; candidates: Candidate[] }
  | { status: 'ambiguous'; best: Candidate; candidates: Candidate[] }
  | { status: 'unidentified'; best: null; candidates: [] };

/** Un quartier est candidat si la position est à moins de 1,5 fois le rayon d'un repère. */
export const CANDIDATE_RADIUS_FACTOR = 1.5;
/** Le meilleur candidat est « clair » si le suivant est au moins 1,5 fois plus loin (en ratio). */
export const CLEAR_WINNER_FACTOR = 1.5;

export function resolveNeighborhood(position: LatLng, landmarks: Landmark[]): Resolution {
  const byNeighborhood = new Map<string, Candidate>();

  for (const landmark of landmarks) {
    const distance = distanceMeters(position, landmark);
    const ratio = distance / landmark.radiusMeters;
    if (ratio > CANDIDATE_RADIUS_FACTOR) continue;
    const current = byNeighborhood.get(landmark.neighborhoodId);
    if (!current || ratio < current.ratio) {
      byNeighborhood.set(landmark.neighborhoodId, {
        neighborhoodId: landmark.neighborhoodId,
        neighborhoodName: landmark.neighborhoodName,
        distanceMeters: Math.round(distance),
        ratio,
      });
    }
  }

  const candidates = [...byNeighborhood.values()].sort((a, b) => a.ratio - b.ratio);
  const [best, second] = candidates;
  if (!best) return { status: 'unidentified', best: null, candidates: [] };

  // Un ratio nul (position sur le repère) compte comme très proche, sans division par zéro.
  const clear = !second || second.ratio >= Math.max(best.ratio, 0.05) * CLEAR_WINNER_FACTOR;
  return { status: clear ? 'automatic' : 'ambiguous', best, candidates };
}

/**
 * Applique le choix éventuel de l'habitant. Seul un quartier candidat est accepté :
 * on ne rattache pas un signalement à un quartier éloigné de sa position.
 */
export function applyCorrection(
  resolution: Resolution,
  chosenNeighborhoodId: string | undefined,
): { neighborhoodId: string | null; attachment: 'AUTOMATIC' | 'CORRECTED' | 'UNIDENTIFIED' } {
  if (resolution.status === 'unidentified')
    return { neighborhoodId: null, attachment: 'UNIDENTIFIED' };
  if (chosenNeighborhoodId && chosenNeighborhoodId !== resolution.best.neighborhoodId) {
    const chosen = resolution.candidates.find((c) => c.neighborhoodId === chosenNeighborhoodId);
    if (chosen) return { neighborhoodId: chosen.neighborhoodId, attachment: 'CORRECTED' };
  }
  return { neighborhoodId: resolution.best.neighborhoodId, attachment: 'AUTOMATIC' };
}
