/**
 * Génère les fichiers de marque de public/brand/ à partir de la géométrie du logo retenu
 * (concept B « Goutte-signal », D-020). La géométrie est écrite à la main sur une grille
 * de 64 ; ce script se contente de l'assembler en variantes, de vectoriser le nom en
 * Poppins SemiBold et de rendre les PNG (favicon, icônes PWA, partage) avec Chrome.
 *
 * Usage : npm run brand
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { chromium } from '@playwright/test';

const OUT = 'public/brand';

const COLORS = {
  water: '#0B6FA4',
  green: '#1B5E20',
  yellow: '#F9B72B',
  ink: '#14211A',
  light: '#F7F9F7',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// --- Géométrie du symbole (grille 64 × 64) --------------------------------------------
// Goutte : pointe en (24,6), ventre de rayon 16 centré en (24,40).
const DROP = 'M24 6c-7 9-16 20-16 34a16 16 0 0 0 32 0c0-14-9-25-16-34Z';
// Ligne d'eau dans la goutte.
const WAVE = 'M15 42c3-3 6-3 9 0s6 3 9 0';
// Ondes d'alerte : arcs de rayon 22 et 30 centrés sur le ventre, de -35° à +35°.
const ARCS = ['M42 27.4a22 22 0 0 1 0 25.2', 'M48.6 22.8a30 30 0 0 1 0 34.4'];
// Version petites tailles (≤ 32 px) : traits plus épais, une seule onde de rayon 27 (±40°).
const SMALL_WAVE = 'M14.5 42c3.2-3.2 6.3-3.2 9.5 0s6.3 3.2 9.5 0';
const SMALL_ARC = 'M44.7 22.6a27 27 0 0 1 0 34.8';

type Palette = { drop: string; wave: string; arcs: string };
type Tone = 'color' | 'dark' | 'mono-black' | 'mono-white';

const palettes: Record<Tone, Palette> = {
  color: { drop: COLORS.water, wave: COLORS.white, arcs: COLORS.green },
  dark: { drop: COLORS.water, wave: COLORS.light, arcs: COLORS.yellow },
  'mono-black': { drop: COLORS.black, wave: 'none', arcs: COLORS.black },
  'mono-white': { drop: COLORS.white, wave: 'none', arcs: COLORS.white },
};

/** Contenu SVG du symbole (sans balise <svg>), pour la grille 64. */
function symbolBody(tone: Tone, small = false, idPrefix = 's'): string {
  const p = palettes[tone];
  const wave = small ? SMALL_WAVE : WAVE;
  const waveWidth = small ? 5 : 3.5;
  const arcs = small
    ? `<path fill="none" stroke="${p.arcs}" stroke-width="6" stroke-linecap="round" d="${SMALL_ARC}"/>`
    : ARCS.map(
        (d) =>
          `<path fill="none" stroke="${p.arcs}" stroke-width="4" stroke-linecap="round" d="${d}"/>`,
      ).join('');

  // En monochrome, la ligne d'eau est évidée (transparente) pour rester lisible sur tout fond.
  if (p.wave === 'none') {
    const maskId = `${idPrefix}-wave`;
    return [
      `<mask id="${maskId}"><rect width="64" height="64" fill="#FFFFFF"/>`,
      `<path fill="none" stroke="#000000" stroke-width="${waveWidth}" stroke-linecap="round" d="${wave}"/></mask>`,
      `<path fill="${p.drop}" mask="url(#${maskId})" d="${DROP}"/>`,
      arcs,
    ].join('');
  }
  return [
    `<path fill="${p.drop}" d="${DROP}"/>`,
    `<path fill="none" stroke="${p.wave}" stroke-width="${waveWidth}" stroke-linecap="round" d="${wave}"/>`,
    arcs,
  ].join('');
}

function svg(
  viewBox: string,
  title: string,
  body: string,
  size?: { w: number; h: number },
): string {
  const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${dims} role="img" aria-labelledby="t"><title id="t">${title}</title>${body}</svg>\n`;
}

// --- Nom vectorisé ---------------------------------------------------------------------
function loadFont(weight: 500 | 600) {
  const buffer = readFileSync(
    `node_modules/@fontsource/poppins/files/poppins-latin-${weight}-normal.woff`,
  );
  return opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
}

const semiBold = loadFont(600);
const medium = loadFont(500);

type Font = ReturnType<typeof loadFont>;

/** Arrondit à deux décimales, sans zéros inutiles. */
const fmt = (value: number) => String(Math.round(value * 100) / 100);

/**
 * Tracé d'un texte, glyphe par glyphe (avec crénage). Chaque glyphe est lu une fois en
 * unités de police, puis mis à l'échelle ici : `getPath` d'opentype.js 2.0 produit
 * parfois des coordonnées NaN selon la taille demandée (interpréteur de hinting).
 */
function textPath(font: Font, text: string, x: number, y: number, size: number): string {
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const px = (value: number) => fmt(x + value * scale);
  const py = (value: number) => fmt(y + value * scale);
  let cursor = 0;
  const parts = glyphs.map((glyph, index) => {
    const commands = glyph.getPath(0, 0, font.unitsPerEm).commands;
    const d = commands
      .map((c) => {
        switch (c.type) {
          case 'M':
          case 'L':
            return `${c.type}${px(cursor + c.x)} ${py(c.y)}`;
          case 'Q':
            return `Q${px(cursor + c.x1)} ${py(c.y1)} ${px(cursor + c.x)} ${py(c.y)}`;
          case 'C':
            return `C${px(cursor + c.x1)} ${py(c.y1)} ${px(cursor + c.x2)} ${py(c.y2)} ${px(cursor + c.x)} ${py(c.y)}`;
          default:
            return 'Z';
        }
      })
      .join('');
    const next = glyphs[index + 1];
    cursor += glyph.advanceWidth ?? 0;
    if (next) cursor += font.getKerningValue(glyph, next) || 0;
    return d;
  });
  const d = parts.join('');
  if (d.includes('NaN')) throw new Error(`Tracé invalide pour « ${text} »`);
  return d;
}

type Wordmark = { body: string; width: number };

/** « Banlieue Alerte » en deux couleurs, ligne de base en (x, y). */
function wordmark(x: number, y: number, size: number, first: string, second: string): Wordmark {
  const part1 = 'Banlieue ';
  const w1 = semiBold.getAdvanceWidth(part1, size);
  const w2 = semiBold.getAdvanceWidth('Alerte', size);
  const d1 = textPath(semiBold, 'Banlieue', x, y, size);
  const d2 = textPath(semiBold, 'Alerte', x + w1, y, size);
  return {
    body: `<path fill="${first}" d="${d1}"/><path fill="${second}" d="${d2}"/>`,
    width: w1 + w2,
  };
}

const wordmarkColors: Record<Tone, [string, string]> = {
  color: [COLORS.ink, COLORS.green],
  dark: [COLORS.light, COLORS.yellow],
  'mono-black': [COLORS.black, COLORS.black],
  'mono-white': [COLORS.white, COLORS.white],
};

const toneLabel: Record<Tone, string> = {
  color: '',
  dark: ' (fond sombre)',
  'mono-black': ' (monochrome noir)',
  'mono-white': ' (monochrome blanc)',
};

const fileSuffix: Record<Tone, string> = {
  color: '',
  dark: '-dark',
  'mono-black': '-mono-black',
  'mono-white': '-mono-white',
};

function horizontal(tone: Tone): string {
  // Symbole 64 × 64 (marge interne de 6 à gauche), nom en 30 px, ligne de base à 43,5
  // pour centrer la hauteur de capitale sur le centre visuel du symbole.
  const [c1, c2] = wordmarkColors[tone];
  const text = wordmark(64, 43.5, 30, c1, c2);
  const width = Math.ceil(64 + text.width + 4);
  return svg(
    `6 0 ${width - 6} 64`,
    `Banlieue Alerte${toneLabel[tone]}`,
    symbolBody(tone, false, 'h') + text.body,
  );
}

function vertical(tone: Tone): string {
  const [c1, c2] = wordmarkColors[tone];
  const size = 22;
  const textWidth = semiBold.getAdvanceWidth('Banlieue Alerte', size);
  const width = Math.ceil(textWidth + 8);
  const text = wordmark((width - textWidth) / 2, 88, size, c1, c2);
  const offset = (width - 64) / 2 + 1; // +1 : compense la marge interne de la goutte
  return svg(
    `0 0 ${width} 96`,
    `Banlieue Alerte${toneLabel[tone]}`,
    `<g transform="translate(${offset.toFixed(2)} 0)">${symbolBody(tone, false, 'v')}</g>` +
      text.body,
  );
}

// --- Écriture des SVG ------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const written: string[] = [];
function write(name: string, content: string | Buffer) {
  writeFileSync(join(OUT, name), content);
  written.push(name);
}

for (const tone of ['color', 'dark', 'mono-black', 'mono-white'] as const) {
  write(
    `symbol${fileSuffix[tone]}.svg`,
    svg('0 0 64 64', `Banlieue Alerte${toneLabel[tone]}`, symbolBody(tone)),
  );
  write(`logo-horizontal${fileSuffix[tone]}.svg`, horizontal(tone));
  write(`logo-vertical${fileSuffix[tone]}.svg`, vertical(tone));
}
// Favicon SVG : les ondes passent au jaune quand le navigateur est en thème sombre
// (le vert n'offre qu'environ 2:1 de contraste sur un onglet sombre).
write(
  'favicon.svg',
  svg(
    '0 0 64 64',
    'Banlieue Alerte',
    `<style>@media (prefers-color-scheme: dark){.arc{stroke:${COLORS.yellow}}}</style>` +
      symbolBody('color', true, 'f').replace(
        '<path fill="none" stroke="#1B5E20"',
        '<path class="arc" fill="none" stroke="#1B5E20"',
      ),
  ),
);

// --- Rendu PNG avec Chrome ------------------------------------------------------------
type Raster = { name: string; width: number; height: number; html: string };

function framed(
  width: number,
  height: number,
  background: string,
  inner: string,
  scale: number,
  radius = 0,
) {
  const s = Math.round(Math.min(width, height) * scale);
  return `<div style="width:${width}px;height:${height}px;display:grid;place-items:center;background:${background};border-radius:${radius}px">${inner.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`;
}

const smallSymbol = svg('0 0 64 64', 'Banlieue Alerte', symbolBody('color', true, 'p'));
const fullSymbol = svg('0 0 64 64', 'Banlieue Alerte', symbolBody('color', false, 'q'));

const tagline = textPath(
  medium,
  'Signaler, prévenir et suivre les inondations à Thiaroye et Pikine',
  0,
  0,
  34,
);
const taglineWidth = medium.getAdvanceWidth(
  'Signaler, prévenir et suivre les inondations à Thiaroye et Pikine',
  34,
);

const rasters: Raster[] = [
  {
    name: 'favicon-16.png',
    width: 16,
    height: 16,
    html: framed(16, 16, 'transparent', smallSymbol, 1),
  },
  {
    name: 'favicon-32.png',
    width: 32,
    height: 32,
    html: framed(32, 32, 'transparent', smallSymbol, 1),
  },
  {
    name: 'favicon-48.png',
    width: 48,
    height: 48,
    html: framed(48, 48, 'transparent', smallSymbol, 1),
  },
  // Icônes « any » : tuile blanche arrondie (22 %), lisible sur les fonds sombres des lanceurs.
  {
    name: 'icon-192.png',
    width: 192,
    height: 192,
    html: framed(192, 192, COLORS.white, fullSymbol, 0.78, 42),
  },
  {
    name: 'icon-512.png',
    width: 512,
    height: 512,
    html: framed(512, 512, COLORS.white, fullSymbol, 0.78, 113),
  },
  // Maskable : symbole dans la zone sûre (cercle de 80 %), fond plein.
  {
    name: 'icon-maskable-192.png',
    width: 192,
    height: 192,
    html: framed(192, 192, COLORS.white, fullSymbol, 0.62),
  },
  {
    name: 'icon-maskable-512.png',
    width: 512,
    height: 512,
    html: framed(512, 512, COLORS.white, fullSymbol, 0.62),
  },
  {
    name: 'apple-touch-icon.png',
    width: 180,
    height: 180,
    html: framed(180, 180, COLORS.white, fullSymbol, 0.72),
  },
  {
    name: 'og-image.png',
    width: 1200,
    height: 630,
    html: `<div style="width:1200px;height:630px;background:${COLORS.light};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px">
      ${horizontal('color').replace('<svg ', '<svg height="150" ')}
      <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(taglineWidth)}" height="48" viewBox="0 -36 ${Math.ceil(taglineWidth)} 48"><path fill="#4A5A50" d="${tagline}"/></svg>
    </div>`,
  },
];

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const pngs: Record<string, Buffer> = {};
for (const raster of rasters) {
  await page.setViewportSize({ width: raster.width, height: raster.height });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${raster.html}</body></html>`,
  );
  const png = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: raster.width, height: raster.height },
  });
  pngs[raster.name] = png;
  write(raster.name, png);
}
await browser.close();

// --- favicon.ico (16, 32, 48 en PNG dans un conteneur ICO) ----------------------------
const icoImages = ['favicon-16.png', 'favicon-32.png', 'favicon-48.png'].map((name) => pngs[name]!);
const header = Buffer.alloc(6 + 16 * icoImages.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach((image, index) => {
  const size = [16, 32, 48][index]!;
  const entry = 6 + index * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
const ico = Buffer.concat([header, ...icoImages]);
write('favicon.ico', ico);
// Copie à la racine : navigateurs et robots demandent /favicon.ico quoi que déclare la page.
writeFileSync('public/favicon.ico', ico);
written.push('../favicon.ico');

console.log(`public/brand : ${written.length} fichiers générés\n- ${written.join('\n- ')}`);
