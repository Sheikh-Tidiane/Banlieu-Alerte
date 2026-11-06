import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectRoutes, renderOpenApi } from '../../scripts/build-openapi';

describe('documentation de l’API (CDC §10)', () => {
  it('docs/openapi.yaml décrit exactement les routes du code (npm run openapi)', () => {
    const routes = collectRoutes();
    expect(routes.length).toBeGreaterThan(50);
    expect(readFileSync('docs/openapi.yaml', 'utf8').replace(/\r\n/g, '\n')).toBe(
      renderOpenApi(routes),
    );
  });

  it('chaque opération a un résumé', () => {
    expect(collectRoutes().every((r) => r.summary.length > 5)).toBe(true);
  });
});
