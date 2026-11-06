/**
 * Recalcul de l'indice de risque (D-048), à lancer toutes les 3 heures par le cron du
 * système (conteneur dédié en Phase 6) : météo Open-Meteo, cellules, quartiers, brouillons.
 *
 * Usage : npm run job:risk
 * Exemple de crontab : 0 *\/3 * * * cd /app && npm run job:risk
 */
import 'dotenv/config';
import { getPrisma } from '../src/lib/db';
import { runRiskJob } from '../src/jobs/risk-refresh';

try {
  const result = await runRiskJob('script');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
