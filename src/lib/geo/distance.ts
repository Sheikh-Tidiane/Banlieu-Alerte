// Calculs géographiques simples (D-014) : suffisants à l'échelle d'un quartier.

const EARTH_RADIUS_METERS = 6_371_000;

export type LatLng = { lat: number; lng: number };

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distance de Haversine, en mètres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Boîte englobante d'un cercle, pour pré-filtrer par index (lat, lng) avant Haversine. */
export function boundingBox(center: LatLng, radiusMeters: number) {
  const dLat = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const dLng = dLat / Math.cos(toRadians(center.lat));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Arrondi d'une coordonnée publique (D-025 : 3 décimales, environ 110 m). */
export function roundCoordinate(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Zone de service : région de Dakar au sens large (département de Pikine et alentours).
 * Une position hors de cette zone est refusée avec un message clair ; à l'intérieur,
 * une position loin de tout repère donne « quartier non identifié ».
 */
export const SERVICE_AREA = { minLat: 14.55, maxLat: 14.95, minLng: -17.6, maxLng: -17.1 } as const;

export function isInServiceArea({ lat, lng }: LatLng): boolean {
  return (
    lat >= SERVICE_AREA.minLat &&
    lat <= SERVICE_AREA.maxLat &&
    lng >= SERVICE_AREA.minLng &&
    lng <= SERVICE_AREA.maxLng
  );
}
