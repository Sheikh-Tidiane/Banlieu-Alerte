import { distanceMeters } from '@/lib/geo/distance';
import { indexCells, neighborsOf } from '@/lib/geo/cells';
import type { RainInputs } from '@/lib/weather/aggregate';
import type { FactorInputs } from './types';

// Préparation des entrées d'une cellule (code pur).

export type CellForRisk = {
  id: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  sizeMeters: number;
  relativeElevation: number | null;
  slopePercent: number | null;
};

export type DrainReport = { lat: number; lng: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' };

export const SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 2, HIGH: 3 } as const;

/**
 * Pression des caniveaux et dépôts : somme des gravités des signalements situés dans la
 * cellule ou ses 8 voisines (CDC §5.3). Un signalement hors grille est ignoré.
 */
export function drainPressure(cells: CellForRisk[], reports: DrainReport[]): Map<string, number> {
  const own = new Map<string, number>(cells.map((c) => [c.id, 0]));
  for (const report of reports) {
    let nearest: CellForRisk | null = null;
    let best = Infinity;
    for (const cell of cells) {
      const d = distanceMeters(report, cell);
      if (d < best) {
        best = d;
        nearest = cell;
      }
    }
    // Hors de la grille : plus loin que la demi-diagonale d'une cellule.
    if (!nearest || best > (nearest.sizeMeters * Math.SQRT2) / 2) continue;
    own.set(nearest.id, (own.get(nearest.id) ?? 0) + SEVERITY_WEIGHT[report.severity]);
  }
  const index = indexCells(cells);
  return new Map(
    cells.map((cell) => [
      cell.id,
      [cell, ...neighborsOf(cell, index)].reduce((sum, c) => sum + (own.get(c.id) ?? 0), 0),
    ]),
  );
}

export function cellInputs(cell: CellForRisk, rain: RainInputs, drain: number): FactorInputs {
  return {
    rain24h: rain.rainWindow,
    rain6hMax: rain.rain6hMax,
    saturation: rain.saturation,
    lowArea: cell.relativeElevation,
    slope: cell.slopePercent,
    drainReports: drain,
    // Étiquettes « inondé / non inondé » validées : Phase 5. Absent, jamais inventé.
    history: null,
  };
}
