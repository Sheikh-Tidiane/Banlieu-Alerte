import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listKeys, translate } from '@/i18n';
import { fr } from '@/i18n/fr';
import { wo } from '@/i18n/wo';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('i18n (EXG-19)', () => {
  const frKeys = new Set(listKeys(fr));

  it('le wolof ne contient aucune clé inconnue du français', () => {
    expect(listKeys(wo).filter((key) => !frKeys.has(key))).toEqual([]);
  });

  it('toutes les clés littérales utilisées dans src/ existent en français', () => {
    const used = new Set<string>();
    for (const file of sourceFiles('src')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/translate\('([a-zA-Z0-9_.]+)'\)/g)) {
        if (match[1]) used.add(match[1]);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((key) => !frKeys.has(key))).toEqual([]);
  });

  it('retombe sur le français quand la clé manque en wolof', () => {
    expect(translate('app.name', 'wo')).toBe(fr.app.name);
  });
});
