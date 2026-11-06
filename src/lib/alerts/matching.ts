import { distanceMeters, type LatLng } from '@/lib/geo/distance';
import { compareLevels } from '@/lib/risk/score';
import type { RiskLevelCode } from '@/lib/risk/types';

// Correspondance alerte ↔ abonnement (D-050). Code pur, testé sans base.

export type SubscriptionForMatch = {
  minLevel: RiskLevelCode;
  neighborhoodIds: string[];
  point: (LatLng & { radiusMeters: number }) | null;
};

export type AlertForMatch = {
  level: RiskLevelCode;
  neighborhoodIds: string[];
  /** Repères des quartiers visés : la zone de l'alerte. */
  landmarks: (LatLng & { radiusMeters: number })[];
};

export function subscriptionMatches(
  subscription: SubscriptionForMatch,
  alert: AlertForMatch,
): boolean {
  if (compareLevels(alert.level, subscription.minLevel) < 0) return false;
  if (subscription.neighborhoodIds.some((id) => alert.neighborhoodIds.includes(id))) return true;
  const point = subscription.point;
  if (!point) return false;
  return alert.landmarks.some(
    (landmark) => distanceMeters(point, landmark) <= point.radiusMeters + landmark.radiusMeters,
  );
}

/** Langue du message : wolof seulement s'il existe et a été relu (CDC §4.6). */
export function deliveryLocale(
  subscriptionLocale: string,
  alert: { messageWo: string | null; woReviewed: boolean },
): 'fr' | 'wo' {
  return subscriptionLocale === 'wo' && alert.messageWo && alert.woReviewed ? 'wo' : 'fr';
}
