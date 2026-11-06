import { interpolate, translate } from '@/i18n';
import { getPrisma } from '@/lib/db';
import {
  escalationDue,
  ruleFor,
  scopeOf,
  type ReportTypeCode,
  type SeverityCode,
} from '@/lib/escalation/rules';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { notify } from '@/services/notifications/user-notifications';

// Escalade (D-056, EXG-36) : un signalement resté « Nouveau » au-delà du délai cible remonte
// à l'agent (échelon 1), puis à l'administrateur (échelon 2), qui sont prévenus dans l'application.

export async function listEscalationRules() {
  return getPrisma().escalationRule.findMany({
    orderBy: [{ targetHours: 'asc' }, { scope: 'asc' }],
    select: { id: true, scope: true, type: true, severity: true, targetHours: true },
  });
}

export async function runEscalation(now = new Date()) {
  const prisma = getPrisma();
  const rules = await listEscalationRules();
  if (rules.length === 0) return { escalated: 0 };

  const candidates = await prisma.report.findMany({
    where: { status: 'NEW', duplicateOfId: null, escalationLevel: { lt: 2 } },
    select: {
      id: true,
      trackingCode: true,
      type: true,
      severity: true,
      status: true,
      createdAt: true,
      escalationLevel: true,
      neighborhood: { select: { communeId: true } },
    },
  });

  let escalated = 0;
  for (const report of candidates) {
    const rule = ruleFor(rules, report.type, report.severity);
    if (!rule) continue;
    const level = escalationDue(report, rule.targetHours, now);
    if (level === null) continue;

    // Destinataires : agents de la commune (ou tous les agents si le quartier est inconnu),
    // puis administrateurs.
    const recipients = await prisma.user.findMany({
      where:
        level === 1
          ? {
              role: 'AGENT',
              status: 'ACTIVE',
              ...(report.neighborhood ? { communeId: report.neighborhood.communeId } : {}),
            }
          : { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    const done = await prisma.$transaction(async (tx) => {
      // Conditionnel : deux passages simultanés ne notifient qu'une fois.
      const claimed = await tx.report.updateMany({
        where: { id: report.id, status: 'NEW', escalationLevel: { lt: level } },
        data: { escalationLevel: level, escalatedAt: now },
      });
      if (claimed.count !== 1) return false;
      await notify(
        recipients.map((r) => ({
          userId: r.id,
          kind: 'ESCALATION' as const,
          reportId: report.id,
          title: interpolate(translate('escalation.title'), {
            code: report.trackingCode,
            hours: rule.targetHours * level,
          }),
          link: `/back-office/signalements/${report.trackingCode}`,
        })),
        tx,
      );
      await recordAudit(
        {
          actorId: null,
          action: 'report.escalated',
          entityType: 'report',
          entityId: report.id,
          metadata: { level, targetHours: rule.targetHours, recipients: recipients.length },
        },
        tx,
      );
      return true;
    });
    if (done) escalated += 1;
  }
  return { escalated };
}

export async function updateEscalationRules(
  user: AuthUser,
  rules: { type: ReportTypeCode | null; severity: SeverityCode | null; targetHours: number }[],
) {
  if (user.role !== 'ADMIN') throw new ServiceError('FORBIDDEN', 'Réservé aux administrateurs.');
  if (!rules.some((r) => r.type === null && r.severity === null)) {
    throw new ServiceError('VALIDATION_ERROR', 'Une règle générale (tous types) est obligatoire.');
  }
  await getPrisma().$transaction(async (tx) => {
    await tx.escalationRule.deleteMany({});
    await tx.escalationRule.createMany({
      data: rules.map((r) => ({ ...r, scope: scopeOf(r.type, r.severity) })),
      skipDuplicates: true,
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'escalation.rules_updated',
        entityType: 'escalation_rule',
        metadata: { count: rules.length },
      },
      tx,
    );
  });
  return { updated: rules.length };
}
