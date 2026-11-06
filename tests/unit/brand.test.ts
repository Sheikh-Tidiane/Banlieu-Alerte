import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Couleurs autorisées : palette du design system (docs/DESIGN_ET_MARQUE.md §1 et §3).
const PALETTE = new Set([
  '#1B5E20',
  '#2E7D32',
  '#F9B72B',
  '#0B6FA4',
  '#FFFFFF',
  '#F7F9F7',
  '#14211A',
]);
const NEUTRALS = new Set(['#FFFFFF', '#F7F9F7', '#14211A']);

describe('concepts de logo (EXG-27, étape concepts)', () => {
  for (const id of ['a', 'b', 'c']) {
    for (const background of ['light', 'dark']) {
      const file = `public/brand/concepts/concept-${id}-${background}.svg`;

      it(`${file} est un SVG vectoriel valide et accessible`, () => {
        const svg = readFileSync(file, 'utf8');
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"/);
        expect(svg.trim().endsWith('</svg>')).toBe(true);
        expect(svg).toMatch(/<title id="t">[^<]+<\/title>/);
        expect(svg).not.toMatch(/<image|<text|base64|filter|Gradient/);
      });

      it(`${file} : 3 couleurs de marque au plus, plus un neutre`, () => {
        const colors = new Set(
          [...readFileSync(file, 'utf8').matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) =>
            m[0].toUpperCase(),
          ),
        );
        for (const color of colors) expect(PALETTE.has(color)).toBe(true);
        expect([...colors].filter((c) => !NEUTRALS.has(c)).length).toBeLessThanOrEqual(3);
      });
    }
  }
});
