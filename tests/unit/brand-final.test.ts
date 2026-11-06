import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const BRAND = 'public/brand';

const svgFiles = ['symbol', 'logo-horizontal', 'logo-vertical'].flatMap((base) =>
  ['', '-dark', '-mono-black', '-mono-white'].map((suffix) => `${base}${suffix}.svg`),
);

/** Largeur et hauteur d'un PNG (bloc IHDR). */
function pngSize(file: string) {
  const buffer = readFileSync(`${BRAND}/${file}`);
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('logo retenu : fichiers de public/brand (EXG-27)', () => {
  for (const file of [...svgFiles, 'favicon.svg']) {
    it(`${file} est un SVG vectoriel valide, sans texte ni image`, () => {
      const svg = readFileSync(`${BRAND}/${file}`, 'utf8');
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. ]+"/);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
      expect(svg).toMatch(/<title id="t">[^<]+<\/title>/);
      expect(svg).not.toMatch(/NaN|<image|<text|base64|filter|Gradient/);
    });
  }

  it('les versions monochromes n’utilisent qu’une couleur', () => {
    for (const file of svgFiles.filter((f) => f.includes('mono'))) {
      const colors = new Set(
        [
          ...readFileSync(`${BRAND}/${file}`, 'utf8')
            .replace(/<mask[\s\S]*?<\/mask>/g, '')
            .matchAll(/#[0-9A-F]{6}/gi),
        ].map((m) => m[0].toUpperCase()),
      );
      expect(colors.size).toBe(1);
    }
  });

  it('les couleurs du logo respectent les contrastes de docs/MARQUE.md', () => {
    const light = '#F7F9F7';
    const dark = '#14211A';
    expect(contrast('#0B6FA4', light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#1B5E20', light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#14211A', light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#0B6FA4', dark)).toBeGreaterThanOrEqual(3);
    expect(contrast('#F9B72B', dark)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#F7F9F7', dark)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('favicon et icônes PWA (EXG-28)', () => {
  it.each([
    ['favicon-16.png', 16, 16],
    ['favicon-32.png', 32, 32],
    ['favicon-48.png', 48, 48],
    ['icon-192.png', 192, 192],
    ['icon-512.png', 512, 512],
    ['icon-maskable-192.png', 192, 192],
    ['icon-maskable-512.png', 512, 512],
    ['apple-touch-icon.png', 180, 180],
    ['og-image.png', 1200, 630],
  ])('%s fait %i × %i px', (file, width, height) => {
    expect(pngSize(file)).toEqual({ width, height });
  });

  it('favicon.ico contient les tailles 16, 32 et 48', () => {
    const ico = readFileSync(`${BRAND}/favicon.ico`);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + i * 16));
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('le manifeste référence les icônes 192, 512 et masquables, qui existent', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
      icons: { src: string; sizes: string; purpose: string }[];
    };
    const has = (sizes: string, purpose: string) =>
      manifest.icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose);
    expect(has('192x192', 'any') && has('512x512', 'any')).toBe(true);
    expect(has('192x192', 'maskable') && has('512x512', 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      expect(() => readFileSync(`public${icon.src}`)).not.toThrow();
    }
  });
});
