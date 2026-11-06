import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('design tokens', () => {
  const css = readFileSync('src/app/globals.css', 'utf8').toLowerCase();

  it('reprend la palette de docs/DESIGN_ET_MARQUE.md', () => {
    const palette = ['#1b5e20', '#2e7d32', '#f9b72b', '#0b6fa4', '#d32f2f'];
    const functional = ['#f57c00', '#388e3c', '#f7f9f7', '#14211a', '#dde5de'];
    for (const color of [...palette, ...functional]) expect(css).toContain(color);
  });

  it('déclare les quatre niveaux de risque et la zone tactile de 48 px', () => {
    for (const level of ['low', 'moderate', 'high', 'critical']) {
      expect(css).toContain(`--color-risk-${level}:`);
    }
    expect(css).toContain('--spacing-touch: 48px');
  });

  it('respecte prefers-reduced-motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
