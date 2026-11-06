import { getPrisma } from '@/lib/db';
import type { LatLng } from '@/lib/geo/distance';
import { resolveNeighborhood, type Landmark, type Resolution } from '@/lib/geo/resolve';

/** Repères de tous les quartiers. Peu nombreux pendant le pilote : lus en une requête. */
export async function loadLandmarks(): Promise<Landmark[]> {
  const rows = await getPrisma().neighborhoodLandmark.findMany({
    select: {
      lat: true,
      lng: true,
      radiusMeters: true,
      neighborhood: { select: { id: true, name: true } },
    },
  });
  return rows.map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lng),
    radiusMeters: row.radiusMeters,
    neighborhoodId: row.neighborhood.id,
    neighborhoodName: row.neighborhood.name,
  }));
}

export async function resolvePosition(position: LatLng): Promise<Resolution> {
  return resolveNeighborhood(position, await loadLandmarks());
}

/** Quartiers pour les filtres publics (sans délégué ni donnée personnelle). */
export async function listPublicNeighborhoods() {
  return getPrisma().neighborhood.findMany({
    select: { id: true, name: true, isPilot: true, isDemo: true, boundaryStatus: true },
    orderBy: { name: 'asc' },
  });
}
