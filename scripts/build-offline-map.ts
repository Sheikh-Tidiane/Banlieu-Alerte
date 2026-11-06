/**
 * Fond de plan hors ligne du pilote (D-059, EXG-34) : routes et voies d'eau tirées des DONNÉES
 * OpenStreetMap (licence ODbL) via l'API Overpass, dessinées dans un SVG statique.
 * Aucune tuile OSM n'est téléchargée (la politique d'utilisation des tuiles l'interdit).
 *
 * Usage : npm run map:offline   (après risk:cells : l'emprise est celle de la grille)
 * Sorties : public/offline/pilot-map.svg et public/offline/pilot-map.json
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { getPrisma } from '../src/lib/db';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'BanlieueAlerte/0.1 (projet de concours, fond de plan hors ligne)';
const MARGIN_DEG = 0.002;

type Way = {
  type: 'way';
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

async function overpass(query: string): Promise<Way[]> {
  let delay = 2_000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]!;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(60_000),
      });
      if (response.ok) {
        const body = (await response.json()) as { elements: Way[] };
        return body.elements.filter((e) => e.type === 'way' && e.geometry);
      }
      console.log(`  ${endpoint} : HTTP ${response.status}, nouvel essai dans ${delay / 1000} s`);
    } catch (error) {
      console.log(`  ${endpoint} : ${error instanceof Error ? error.message : error}`);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }
  throw new Error('Overpass indisponible après plusieurs essais.');
}

const ROAD_WIDTH: Record<string, number> = {
  motorway: 6,
  trunk: 5,
  primary: 4.5,
  secondary: 4,
  tertiary: 3.2,
  residential: 2.2,
  unclassified: 2.2,
  living_street: 2,
};

const prisma = getPrisma();
try {
  const cells = await prisma.riskCell.findMany({ select: { centerLat: true, centerLng: true } });
  if (cells.length === 0) throw new Error('Aucune cellule : lancez d’abord npm run risk:cells.');
  const lats = cells.map((c) => Number(c.centerLat));
  const lngs = cells.map((c) => Number(c.centerLng));
  const bounds = {
    south: Math.min(...lats) - MARGIN_DEG,
    north: Math.max(...lats) + MARGIN_DEG,
    west: Math.min(...lngs) - MARGIN_DEG,
    east: Math.max(...lngs) + MARGIN_DEG,
  };
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  console.log(`Emprise : ${bbox}. Requête Overpass…`);
  const ways = await overpass(
    `[out:json][timeout:50];(way["highway"](${bbox});way["waterway"](${bbox});way["natural"="water"](${bbox});way["natural"="coastline"](${bbox}););out geom;`,
  );

  // Projection équirectangulaire locale : 1 unité = 1 m environ.
  const midLat = (bounds.south + bounds.north) / 2;
  const kx = 111_320 * Math.cos((midLat * Math.PI) / 180);
  const ky = 111_320;
  const width = Math.round((bounds.east - bounds.west) * kx);
  const height = Math.round((bounds.north - bounds.south) * ky);
  const point = (p: { lat: number; lon: number }) =>
    `${Math.round((p.lon - bounds.west) * kx)},${Math.round((bounds.north - p.lat) * ky)}`;

  const water: string[] = [];
  const roads: string[] = [];
  const names = new Map<string, { x: number; y: number }>();
  // Simplification : un point est gardé s'il est à plus de 5 m du précédent (poids du fichier).
  const simplify = (geometry: { lat: number; lon: number }[]) => {
    const kept: string[] = [];
    let last: [number, number] | null = null;
    geometry.forEach((p, i) => {
      const [x, y] = point(p).split(',').map(Number) as [number, number];
      if (!last || i === geometry.length - 1 || Math.hypot(x - last[0], y - last[1]) > 5) {
        kept.push(`${x},${y}`);
        last = [x, y];
      }
    });
    return kept;
  };
  for (const way of ways) {
    // Chemin relatif (« m x,y l dx,dy… ») : environ deux fois plus court qu'en absolu.
    const pts = simplify(way.geometry!).map((p) => p.split(',').map(Number) as [number, number]);
    const d = `M${pts[0]!.join(',')}${pts.length > 1 ? 'l' : ''}${pts
      .slice(1)
      .map(([x, y], i) => `${x - pts[i]![0]},${y - pts[i]![1]}`)
      .join(' ')}`;
    const tags = way.tags ?? {};
    if (tags.natural === 'water') water.push(`<path d="${d}Z" class="w"/>`);
    else if (tags.waterway || tags.natural === 'coastline')
      water.push(`<path d="${d}" class="ww"/>`);
    else if (tags.highway && ROAD_WIDTH[tags.highway] !== undefined) {
      roads.push(`<path d="${d}" stroke-width="${ROAD_WIDTH[tags.highway]! * 3}"/>`);
      if (tags.name && ['primary', 'secondary', 'tertiary', 'trunk'].includes(tags.highway)) {
        const mid = way.geometry![Math.floor(way.geometry!.length / 2)]!;
        const [x, y] = point(mid).split(',').map(Number) as [number, number];
        names.set(tags.name, { x, y });
      }
    }
  }
  const labels = [...names]
    .slice(0, 25)
    .map(([name, { x, y }]) => `<text x="${x}" y="${y}">${name.replace(/[<&>"]/g, '')}</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<title>Plan hors ligne du pilote – © contributeurs OpenStreetMap (ODbL)</title>
<style>.w{fill:#cfe8f5}.ww{fill:none;stroke:#7fb8d8;stroke-width:8}g.r path{fill:none;stroke:#ffffff;stroke-linecap:round;stroke-linejoin:round}g.c path{fill:none;stroke:#c9c2b0;stroke-linecap:round;stroke-linejoin:round}text{font:600 34px sans-serif;fill:#4a5a50;paint-order:stroke;stroke:#f2efe6;stroke-width:6}</style>
<rect width="100%" height="100%" fill="#f2efe6"/>
${water.join('')}
<g class="c">${roads.map((r) => r.replace(/stroke-width="(\d+(\.\d+)?)"/, (_, w) => `stroke-width="${Number(w) + 4}"`)).join('')}</g>
<g class="r">${roads.join('')}</g>
${labels.join('')}
</svg>
`;
  await mkdir('public/offline', { recursive: true });
  await writeFile('public/offline/pilot-map.svg', svg, 'utf8');
  await writeFile(
    'public/offline/pilot-map.json',
    `${JSON.stringify(
      {
        bounds: [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        generatedAt: new Date().toISOString(),
        source: 'OpenStreetMap via Overpass',
        attribution: '© contributeurs OpenStreetMap (ODbL)',
        ways: ways.length,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(
    `Écrit : public/offline/pilot-map.svg (${(svg.length / 1024).toFixed(0)} Ko, ${ways.length} voies).`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
