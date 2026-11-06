import type { PrismaClient } from '@/generated/prisma/client';
import { computeTerrain, type ElevatedCell } from '@/lib/geo/cells';
import { resolveNeighborhood, type Landmark } from '@/lib/geo/resolve';

// Chargement de la grille du pilote en base (D-044). Les altitudes viennent d'un fichier
// précalculé (`prisma/data/risk-cells.json`, produit par `npm run risk:cells`).

export type CellDataset = {
  source: string;
  fetchedAt: string;
  sizeMeters: number;
  cells: ElevatedCell[];
};

/** SRTM code les surfaces d'eau à 0 m. Une altitude absente n'est pas considérée comme la mer. */
export const isSea = (elevation: number | null) => elevation !== null && elevation <= 0;

export async function loadCellsIntoDatabase(
  prisma: PrismaClient,
  dataset: CellDataset,
  options: { isDemo: boolean },
): Promise<{ cells: number; attached: number }> {
  const landmarks = await prisma.neighborhoodLandmark.findMany({
    where: { neighborhood: { isPilot: true } },
    select: {
      lat: true,
      lng: true,
      radiusMeters: true,
      neighborhood: { select: { id: true, name: true } },
    },
  });
  const resolverLandmarks: Landmark[] = landmarks.map((l) => ({
    lat: Number(l.lat),
    lng: Number(l.lng),
    radiusMeters: l.radiusMeters,
    neighborhoodId: l.neighborhood.id,
    neighborhoodName: l.neighborhood.name,
  }));

  // Les cases de mer (SRTM = 0 m, surface d'eau) sont retirées avant le calcul du relief :
  // un indice « faible » sur la mer serait trompeur, et la mer ferait paraître la côte plus haute.
  const terrain = computeTerrain(dataset.cells.filter((cell) => !isSea(cell.elevationMeters)));
  const rows = terrain.map((cell) => {
    // Rattachement seulement si le quartier est clairement identifié (D-044).
    const resolution = resolveNeighborhood(cell, resolverLandmarks);
    return {
      row: cell.row,
      col: cell.col,
      centerLat: cell.lat,
      centerLng: cell.lng,
      sizeMeters: dataset.sizeMeters,
      elevationMeters: cell.elevationMeters,
      relativeElevation: cell.relativeElevation,
      slopePercent: cell.slopePercent,
      elevationSource: `${dataset.source} (${dataset.fetchedAt.slice(0, 10)})`,
      neighborhoodId: resolution.status === 'automatic' ? resolution.best.neighborhoodId : null,
      isDemo: options.isDemo,
    };
  });

  await prisma.$transaction(async (tx) => {
    // Les prédictions par cellule disparaissent avec la grille (cascade) ; les prédictions
    // par quartier sont conservées.
    await tx.riskCell.deleteMany({});
    await tx.riskCell.createMany({ data: rows });
  });
  return { cells: rows.length, attached: rows.filter((r) => r.neighborhoodId).length };
}
