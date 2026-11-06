/**
 * Tâche planifiée unique (D-057) : escalade, alertes programmées, indice toutes les 3 heures.
 *
 * Usage : npm run jobs
 * Exemple de crontab : *\/15 * * * * cd /app && npm run jobs
 */
import 'dotenv/config';
import { getPrisma } from '../src/lib/db';
import { runScheduledJobs } from '../src/jobs/run-all';

try {
  console.log(JSON.stringify(await runScheduledJobs(), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
