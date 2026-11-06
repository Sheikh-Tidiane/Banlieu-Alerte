import { getPrisma } from '@/lib/db';
import { recordAudit } from '@/services/audit';

// Purge des données selon les durées de conservation (D-043, D-047, D-065).

const DAY_MS = 86_400_000;

export const RETENTION_DAYS = {
  expiredSessions: 30,
  expiredLinks: 90,
  auditLog: 730,
  errorLog: 180,
  readNotifications: 180,
  cellPredictions: 180,
  weatherSnapshots: 180,
  jobRuns: 90,
} as const;

export async function purgeExpiredData(now = new Date()) {
  const prisma = getPrisma();
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);

  const counts = {
    sessions: (
      await prisma.session.deleteMany({
        where: { expiresAt: { lt: before(RETENTION_DAYS.expiredSessions) } },
      })
    ).count,
    invitations: (
      await prisma.invitation.deleteMany({
        where: {
          status: { not: 'ACCEPTED' },
          expiresAt: { lt: before(RETENTION_DAYS.expiredLinks) },
        },
      })
    ).count,
    passwordResets: (
      await prisma.passwordReset.deleteMany({
        where: { expiresAt: { lt: before(RETENTION_DAYS.expiredLinks) } },
      })
    ).count,
    auditLogs: (
      await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: before(RETENTION_DAYS.auditLog) } },
      })
    ).count,
    errorLogs: (
      await prisma.errorLog.deleteMany({
        where: { createdAt: { lt: before(RETENTION_DAYS.errorLog) } },
      })
    ).count,
    notifications: (
      await prisma.userNotification.deleteMany({
        where: {
          readAt: { not: null },
          createdAt: { lt: before(RETENTION_DAYS.readNotifications) },
        },
      })
    ).count,
    // Les prédictions par quartier sont conservées (suivi et évaluation, D-047).
    cellPredictions: (
      await prisma.riskPrediction.deleteMany({
        where: { scope: 'CELL', createdAt: { lt: before(RETENTION_DAYS.cellPredictions) } },
      })
    ).count,
    weatherSnapshots: (
      await prisma.weatherSnapshot.deleteMany({
        where: { fetchedAt: { lt: before(RETENTION_DAYS.weatherSnapshots) }, runs: { none: {} } },
      })
    ).count,
    jobRuns: (
      await prisma.jobRun.deleteMany({
        where: { startedAt: { lt: before(RETENTION_DAYS.jobRuns) } },
      })
    ).count,
  };
  await recordAudit({
    actorId: null,
    action: 'data.purged',
    entityType: 'retention',
    metadata: counts,
  });
  return counts;
}
