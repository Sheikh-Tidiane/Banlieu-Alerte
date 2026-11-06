import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db';
import { sanitizeErrorMessage } from '@/lib/supervision/sanitize';
import { dispatchDueAlerts } from '@/services/alerts/dispatch';
import { runEscalation } from '@/services/escalation/escalation';
import { refreshRisk } from '@/services/risk/refresh';
import { ensureDefaultSettings } from './defaults';
import { purgeExpiredData } from './purge';

// Tâche planifiée unique (D-057), à lancer toutes les 15 minutes : escalade et alertes
// programmées à chaque passage ; indice de risque si le dernier calcul réel a plus de 3 h ;
// purge une fois par jour (D-065). Chaque passage est enregistré (supervision, EXG-37).

export const RISK_REFRESH_EVERY_MS = 3 * 3_600_000;
const DEMO_HOLD_MS = 2 * 3_600_000;
const PURGE_EVERY_MS = 24 * 3_600_000;

export async function runScheduledJobs(now = new Date()) {
  const prisma = getPrisma();
  const run = await prisma.jobRun.create({
    data: { name: 'scheduled', startedAt: now },
    select: { id: true },
  });
  try {
    await ensureDefaultSettings();
    const escalation = await runEscalation(now);
    const scheduledAlertsSent = await dispatchDueAlerts(now);

    const last = await prisma.riskRun.findFirst({
      where: { trigger: { in: ['cron', 'script', 'admin'] } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    // Une démonstration en cours (moins de 2 h) n'est pas écrasée par un calcul réel (D-063).
    const demo = await prisma.riskRun.findFirst({
      where: { trigger: 'demo', createdAt: { gte: new Date(now.getTime() - DEMO_HOLD_MS) } },
      select: { id: true },
    });
    const riskDue =
      !demo && (!last || now.getTime() - last.createdAt.getTime() >= RISK_REFRESH_EVERY_MS);
    // Une installation sans grille de cases (risk:cells pas encore lancé) ne bloque pas le
    // reste de la tâche : l'erreur est journalisée et visible dans la supervision.
    let risk: Awaited<ReturnType<typeof refreshRisk>> | null = null;
    let riskError: string | null = null;
    if (riskDue) {
      try {
        risk = await refreshRisk({ trigger: 'cron', now });
      } catch (error) {
        riskError = sanitizeErrorMessage(
          error instanceof Error ? error.message : 'Erreur inconnue',
        );
        await prisma.errorLog.create({ data: { source: 'risk', message: riskError } });
      }
    }

    const lastPurge = await prisma.jobRun.findFirst({
      where: { name: 'purge', ok: true },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    let purged: Awaited<ReturnType<typeof purgeExpiredData>> | null = null;
    if (!lastPurge || now.getTime() - lastPurge.startedAt.getTime() >= PURGE_EVERY_MS) {
      purged = await purgeExpiredData(now);
      await prisma.jobRun.create({
        data: { name: 'purge', startedAt: now, finishedAt: new Date(), ok: true, summary: purged },
      });
    }

    const summary = {
      escalated: escalation.escalated,
      scheduledAlertsSent,
      riskRefreshed: risk !== null,
      weather: risk?.weather.status ?? null,
      riskError,
      purged: purged !== null,
    } satisfies Prisma.InputJsonObject;
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, summary },
    });
    return { ...summary, risk, purge: purged };
  } catch (error) {
    const message = sanitizeErrorMessage(
      error instanceof Error ? error.message : 'Erreur inconnue',
    );
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: message },
    });
    await prisma.errorLog.create({ data: { source: 'jobs', message } });
    throw error;
  }
}
