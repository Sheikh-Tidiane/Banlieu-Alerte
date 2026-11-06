/**
 * Grille du pilote (D-044) : cellules de 250 m sur l'emprise des repères des quartiers
 * pilotes, plus 500 m de marge ; altitude SRTM 30 m via l'API publique OpenTopoData.
 *
 * Le résultat est écrit dans `prisma/data/risk-cells.json` (versionné : le seed et les tests
 * n'ont pas besoin du réseau), puis chargé en base.
 *
 * Usage : npm run risk:cells            (après le seed, ou avec les vrais quartiers pilotes)
 *         npm run risk:cells -- --no-db (fichier seulement)
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { boundsAround, buildGrid, type ElevatedCell } from '../src/lib/geo/cells';
import { getPrisma } from '../src/lib/db';
import { loadCellsIntoDatabase, type CellDataset } from '../src/services/risk/cells';

const CELL_SIZE_METERS = 250;
const MARGIN_METERS = 500;
const SOURCE = 'SRTM 30 m (NASA/USGS) via OpenTopoData';
const ENDPOINT = 'https://api.opentopodata.org/v1/srtm30m';
// Limites de l'API publique : 100 positions par requête, 1 requête par seconde.
const BATCH_SIZE = 100;
const PAUSE_MS = 1_100;
export const DATASET_PATH = 'prisma/data/risk-cells.json';

type ElevationResponse = { status: string; results?: { elevation: number | null }[] };

async function fetchElevations(points: { lat: number; lng: number }[]): Promise<(number | null)[]> {
  const elevations: (number | null)[] = [];
  for (let start = 0; start < points.length; start += BATCH_SIZE) {
    const batch = points.slice(start, start + BATCH_SIZE);
    const locations = batch.map((p) => `${p.lat},${p.lng}`).join('|');
    const response = await fetch(`${ENDPOINT}?locations=${locations}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`OpenTopoData : HTTP ${response.status}`);
    const body = (await response.json()) as ElevationResponse;
    if (body.status !== 'OK' || !body.results || body.results.length !== batch.length) {
      throw new Error(`OpenTopoData : réponse inattendue (${body.status})`);
    }
    // Une altitude manquante reste absente (jamais remplacée par une valeur inventée).
    elevations.push(
      ...body.results.map((r) => (typeof r.elevation === 'number' ? r.elevation : null)),
    );
    if (start + BATCH_SIZE < points.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
    process.stdout.write(`  ${Math.min(start + BATCH_SIZE, points.length)} / ${points.length}\n`);
  }
  return elevations;
}

const prisma = getPrisma();
try {
  const landmarks = await prisma.neighborhoodLandmark.findMany({
    where: { neighborhood: { isPilot: true } },
    select: { lat: true, lng: true, isDemo: true },
  });
  if (landmarks.length === 0) throw new Error('Aucun repère de quartier pilote en base.');

  const bounds = boundsAround(
    landmarks.map((l) => ({ lat: Number(l.lat), lng: Number(l.lng) })),
    MARGIN_METERS,
  );
  const grid = buildGrid(bounds, CELL_SIZE_METERS);
  console.log(`Grille : ${grid.length} cellules de ${CELL_SIZE_METERS} m. Altitudes SRTM…`);
  const elevations = await fetchElevations(grid);
  const cells: ElevatedCell[] = grid.map((cell, i) => ({
    ...cell,
    elevationMeters: elevations[i] ?? null,
  }));

  const dataset: CellDataset = {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    sizeMeters: CELL_SIZE_METERS,
    cells,
  };
  await mkdir('prisma/data', { recursive: true });
  await writeFile(DATASET_PATH, `${JSON.stringify(dataset, null, 1)}\n`, 'utf8');
  console.log(`Fichier écrit : ${DATASET_PATH}`);

  if (!process.argv.includes('--no-db')) {
    const isDemo = landmarks.every((l) => l.isDemo);
    const result = await loadCellsIntoDatabase(prisma, dataset, { isDemo });
    console.log(
      `Base : ${result.cells} cellules, dont ${result.attached} rattachées à un quartier.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
