import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

// Tests qui nécessitent la base MySQL (docker compose up -d db, migrations et seed appliqués).
export default mergeConfig(
  base,
  defineConfig({
    // Une seule base partagée : les fichiers s'exécutent l'un après l'autre.
    test: {
      include: ['tests/integration/**/*.test.ts'],
      setupFiles: ['dotenv/config'],
      fileParallelism: false,
    },
  }),
);
