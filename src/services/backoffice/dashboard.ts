import { getPrisma } from '@/lib/db';
import { ruleFor } from '@/lib/escalation/rules';
import { listEscalationRules } from '@/services/escalation/escalation';
import { reportScopeWhere } from '@/permissions/scope';
import type { AuthUser } from '@/permissions/types';

/** Indicateurs du tableau de bord, calculés sur la base et dans la portée de l'utilisateur. */
export async function getDashboard(user: AuthUser) {
  const prisma = getPrisma();
  const scope = reportScopeWhere(user);
  const [rules, now] = await Promise.all([listEscalationRules(), Promise.resolve(new Date())]);

  const [newCount, inProgress, resolved, pendingNew, openAbuse, firstResponses] = await Promise.all(
    [
      prisma.report.count({ where: { AND: [scope, { status: 'NEW' }] } }),
      prisma.report.count({
        where: { AND: [scope, { status: { in: ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] } }] },
      }),
      prisma.report.count({ where: { AND: [scope, { status: 'RESOLVED' }] } }),
      // Signalements « Nouveau » : le retard se calcule avec les règles d'escalade (D-056).
      prisma.report.findMany({
        where: { AND: [scope, { status: 'NEW', duplicateOfId: null }] },
        select: {
          trackingCode: true,
          type: true,
          severity: true,
          status: true,
          createdAt: true,
          escalationLevel: true,
          isDemo: true,
          neighborhood: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
      prisma.abuseFlag.count({
        where: {
          status: 'OPEN',
          OR: [{ report: scope }, { comment: { report: scope } }],
        },
      }),
      // Première réponse : premier changement de statut fait par une personne.
      prisma.report.findMany({
        where: { AND: [scope, { statusHistory: { some: { changedById: { not: null } } } }] },
        select: {
          createdAt: true,
          statusHistory: {
            where: { changedById: { not: null } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ],
  );

  const delays = firstResponses
    .map((r) =>
      r.statusHistory[0] ? r.statusHistory[0].createdAt.getTime() - r.createdAt.getTime() : null,
    )
    .filter((d): d is number => d !== null && d >= 0)
    .sort((a, b) => a - b);
  const medianFirstResponseHours =
    delays.length > 0
      ? Math.round((delays[Math.floor(delays.length / 2)]! / 3_600_000) * 10) / 10
      : null;

  const late = pendingNew
    .filter((report) => {
      const rule = ruleFor(rules, report.type, report.severity);
      return (
        report.escalationLevel > 0 ||
        (rule !== null &&
          now.getTime() - report.createdAt.getTime() >= rule.targetHours * 3_600_000)
      );
    })
    .slice(0, 10);

  return {
    newCount,
    inProgress,
    resolved,
    late,
    openAbuse,
    medianFirstResponseHours,
    sampleSize: delays.length,
  };
}
