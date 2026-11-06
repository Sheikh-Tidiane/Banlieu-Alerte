import { distanceMeters, type LatLng } from './distance';

// Grille de cellules du pilote (D-044). Code pur : construction de la grille, voisinage,
// altitude relative et pente à partir d'altitudes précalculées (SRTM).

export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export type GridCell = LatLng & { row: number; col: number };

export type ElevatedCell = GridCell & { elevationMeters: number | null };

export type CellTerrain = ElevatedCell & {
  /** Altitude moins la moyenne des voisines (m) ; négatif = zone basse. */
  relativeElevation: number | null;
  /** Plus grand dénivelé vers une voisine rapporté à la distance (%). */
  slopePercent: number | null;
};

const METERS_PER_DEGREE_LAT = 111_320;

/** Emprise de points (repères), élargie d'une marge en mètres. */
export function boundsAround(points: LatLng[], marginMeters: number): Bounds {
  if (points.length === 0) throw new Error('Aucun point pour construire la grille.');
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = marginMeters / METERS_PER_DEGREE_LAT;
  const dLng = dLat / Math.cos((midLat * Math.PI) / 180);
  return {
    minLat: Math.min(...lats) - dLat,
    maxLat: Math.max(...lats) + dLat,
    minLng: Math.min(...lngs) - dLng,
    maxLng: Math.max(...lngs) + dLng,
  };
}

/** Centres des cellules carrées de `sizeMeters` couvrant l'emprise, ligne 0 au sud. */
export function buildGrid(bounds: Bounds, sizeMeters: number): GridCell[] {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const stepLat = sizeMeters / METERS_PER_DEGREE_LAT;
  const stepLng = stepLat / Math.cos((midLat * Math.PI) / 180);
  const rows = Math.ceil((bounds.maxLat - bounds.minLat) / stepLat);
  const cols = Math.ceil((bounds.maxLng - bounds.minLng) / stepLng);
  const cells: GridCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        row,
        col,
        lat: round6(bounds.minLat + (row + 0.5) * stepLat),
        lng: round6(bounds.minLng + (col + 0.5) * stepLng),
      });
    }
  }
  return cells;
}

const key = (row: number, col: number) => `${row}:${col}`;

/** Les 8 voisines présentes dans la grille. */
export function neighborsOf<T extends { row: number; col: number }>(
  cell: { row: number; col: number },
  index: Map<string, T>,
): T[] {
  const result: T[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const neighbor = index.get(key(cell.row + dr, cell.col + dc));
      if (neighbor) result.push(neighbor);
    }
  }
  return result;
}

export function indexCells<T extends { row: number; col: number }>(cells: T[]): Map<string, T> {
  return new Map(cells.map((cell) => [key(cell.row, cell.col), cell]));
}

/**
 * Altitude relative et pente. Une cellule sans altitude, ou sans voisine mesurée, garde
 * des valeurs absentes (jamais inventées, CDC §5.5).
 */
export function computeTerrain(cells: ElevatedCell[]): CellTerrain[] {
  const index = indexCells(cells);
  return cells.map((cell) => {
    if (cell.elevationMeters === null) {
      return { ...cell, relativeElevation: null, slopePercent: null };
    }
    const measured = neighborsOf(cell, index).filter(
      (n): n is ElevatedCell & { elevationMeters: number } => n.elevationMeters !== null,
    );
    if (measured.length === 0) return { ...cell, relativeElevation: null, slopePercent: null };
    const mean = measured.reduce((sum, n) => sum + n.elevationMeters, 0) / measured.length;
    const slope = Math.max(
      ...measured.map(
        (n) =>
          (Math.abs(n.elevationMeters - cell.elevationMeters!) / distanceMeters(cell, n)) * 100,
      ),
    );
    return {
      ...cell,
      relativeElevation: round2(cell.elevationMeters - mean),
      slopePercent: round2(slope),
    };
  });
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
