import { getPrisma } from '@/lib/db';
import { resolveNotificationMode } from '@/lib/notifications';

// État de santé (EXG-37) : uniquement des compteurs et des dates, aucune donnée personnelle.

const HOUR_MS = 3_600_000;
/** Seuils d'alerte : indice de plus de 6 h, tâche planifiée muette depuis plus d'1 h. */
export const RISK_STALE_AFTER_MS = 6 * HOUR_MS;
export const JOBS_SILENT_AFTER_MS = HOUR_MS;

export type CheckStatus = 'ok' | 'warning' | 'error';

export async function getHealth(now = new Date()) {
  const prisma = getPrisma();
  let database: CheckStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }
  if (database === 'error') {
    return {
      status: 'degraded' as const,
      checks: { database },
      notificationsMode: resolveNotificationMode(),
      demoMode: process.env.DEMO_MODE === 'true',
      time: now.toISOString(),
    };
  }

  const since = new Date(now.getTime() - 24 * HOUR_MS);
  const [lastRun, lastJob, weatherErrors, failedDeliveries, apiErrors] = await Promise.all([
    prisma.riskRun.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, trigger: true, weatherStale: true },
    }),
    prisma.jobRun.findFirst({
      where: { name: 'scheduled' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, ok: true },
    }),
    prisma.errorLog.count({ where: { source: 'weather', createdAt: { gte: since } } }),
    prisma.alertDelivery.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    prisma.errorLog.count({
      where: { source: { in: ['api', 'jobs', 'risk'] }, createdAt: { gte: since } },
    }),
  ]);

  const risk: CheckStatus = !lastRun
    ? 'warning'
    : now.getTime() - lastRun.createdAt.getTime() > RISK_STALE_AFTER_MS || lastRun.weatherStale
      ? 'warning'
      : 'ok';
  const jobs: CheckStatus = !lastJob
    ? 'warning'
    : lastJob.ok === false
      ? 'error'
      : now.getTime() - lastJob.startedAt.getTime() > JOBS_SILENT_AFTER_MS
        ? 'warning'
        : 'ok';
  const weather: CheckStatus = weatherErrors > 0 ? 'warning' : 'ok';
  const notifications: CheckStatus = failedDeliveries > 0 ? 'warning' : 'ok';
  const checks = { database, risk, jobs, weather, notifications };
  const status = Object.values(checks).includes('error')
    ? ('degraded' as const)
    : Object.values(checks).includes('warning')
      ? ('warning' as const)
      : ('ok' as const);

  return {
    status,
    checks,
    details: {
      lastRiskRunAt: lastRun?.createdAt.toISOString() ?? null,
      lastRiskRunTrigger: lastRun?.trigger ?? null,
      lastJobAt: lastJob?.startedAt.toISOString() ?? null,
      weatherErrors24h: weatherErrors,
      failedDeliveries24h: failedDeliveries,
      errors24h: apiErrors,
    },
    notificationsMode: resolveNotificationMode(),
    demoMode: process.env.DEMO_MODE === 'true',
    time: now.toISOString(),
  };
}

export async function getSupervisionData() {
  const prisma = getPrisma();
  const [health, jobs, errors, failures] = await Promise.all([
    getHealth(),
    prisma.jobRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        name: true,
        startedAt: true,
        finishedAt: true,
        ok: true,
        summary: true,
        error: true,
      },
    }),
    prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, source: true, message: true, createdAt: true },
    }),
    prisma.alertDelivery.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        channel: true,
        error: true,
        createdAt: true,
        alert: { select: { title: true } },
      },
    }),
  ]);
  return { health, jobs, errors, failures };
}
