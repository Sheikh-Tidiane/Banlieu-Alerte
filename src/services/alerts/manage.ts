import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db';
import { canIssueAlert, type AlertTarget } from '@/permissions/policies';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { alertIssues, type AlertChanges, type CreateAlertInput } from '@/validators/alerts';
import { dispatchAlert } from './dispatch';

// Cycle de vie d'une alerte (CDC §4.6, EXG-29, EXG-30). Une alerte n'est envoyée qu'après
// une approbation humaine enregistrée (AlertApproval + journal d'audit), jamais à la création.

async function loadTargets(ids: string[]): Promise<AlertTarget[]> {
  const unique = [...new Set(ids)];
  const rows = await getPrisma().neighborhood.findMany({
    where: { id: { in: unique } },
    select: { id: true, communeId: true },
  });
  if (rows.length !== unique.length) {
    throw new ServiceError('VALIDATION_ERROR', 'Quartier inconnu.', {
      neighborhoodIds: ['Quartier inconnu.'],
    });
  }
  return rows;
}

function assertCanIssue(user: AuthUser, type: 'OFFICIAL' | 'INDICATIVE', targets: AlertTarget[]) {
  if (!canIssueAlert(user, type, targets)) {
    throw new ServiceError(
      'FORBIDDEN',
      type === 'OFFICIAL'
        ? 'Alerte officielle réservée aux agents de la commune et aux administrateurs.'
        : 'Quartiers hors de votre périmètre.',
    );
  }
}

function assertValid(value: Parameters<typeof alertIssues>[0]) {
  const issues = alertIssues(value);
  if (issues.length > 0) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      issues[0]!.message,
      Object.fromEntries(issues.map((i) => [i.path, [i.message]])),
    );
  }
}

export async function createAlert(user: AuthUser, input: CreateAlertInput) {
  const targets = await loadTargets(input.neighborhoodIds);
  assertCanIssue(user, input.type, targets);
  const isDemo = await getPrisma().neighborhood.count({
    where: { id: { in: targets.map((t) => t.id) }, isDemo: true },
  });

  return getPrisma().$transaction(async (tx) => {
    const alert = await tx.alert.create({
      data: {
        type: input.type,
        status: 'PENDING_APPROVAL',
        origin: 'MANUAL',
        level: input.level,
        issuerName: input.issuerName,
        title: input.title,
        messageFr: input.messageFr,
        messageWo: input.messageWo ?? null,
        woReviewed: input.woReviewed,
        advice: input.advice ?? null,
        validFrom: input.validFrom ?? new Date(),
        validUntil: input.validUntil,
        scheduledAt: input.scheduledAt ?? null,
        createdById: user.id,
        isDemo: isDemo > 0,
        neighborhoods: { create: targets.map((t) => ({ neighborhoodId: t.id })) },
      },
      select: { id: true, status: true },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'alert.created',
        entityType: 'alert',
        entityId: alert.id,
        metadata: { type: input.type, level: input.level },
      },
      tx,
    );
    return alert;
  });
}

async function loadAlert(id: string) {
  const alert = await getPrisma().alert.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      level: true,
      issuerName: true,
      title: true,
      messageFr: true,
      messageWo: true,
      woReviewed: true,
      advice: true,
      validFrom: true,
      validUntil: true,
      scheduledAt: true,
      neighborhoods: { select: { neighborhood: { select: { id: true, communeId: true } } } },
    },
  });
  if (!alert) throw new ServiceError('NOT_FOUND', 'Alerte introuvable.');
  return { ...alert, targets: alert.neighborhoods.map((n) => n.neighborhood) };
}

type LoadedAlert = Awaited<ReturnType<typeof loadAlert>>;

/** Applique des modifications : renvoie les données Prisma et le détail avant/après. */
async function prepareChanges(
  user: AuthUser,
  alert: LoadedAlert,
  changes: Partial<AlertChanges> = {},
) {
  const targets = changes.neighborhoodIds
    ? await loadTargets(changes.neighborhoodIds)
    : alert.targets;
  assertCanIssue(user, alert.type, targets);
  const next = {
    level: changes.level ?? alert.level,
    issuerName: changes.issuerName ?? alert.issuerName,
    title: changes.title ?? alert.title,
    messageFr: changes.messageFr ?? alert.messageFr,
    messageWo: changes.messageWo ?? alert.messageWo,
    woReviewed: changes.woReviewed ?? alert.woReviewed,
    advice: changes.advice ?? alert.advice,
    validUntil: changes.validUntil ?? alert.validUntil,
    scheduledAt: changes.scheduledAt ?? alert.scheduledAt,
  };
  assertValid({
    type: alert.type,
    issuerName: next.issuerName,
    title: next.title,
    validFrom: alert.validFrom,
    validUntil: next.validUntil,
    messageWo: next.messageWo ?? undefined,
    woReviewed: next.woReviewed,
  });

  // Journal des champs modifiés (noms de champs et valeurs courtes, pas de texte libre).
  const changed: string[] = [];
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    const before = alert[key];
    const after = next[key];
    const same =
      before instanceof Date && after instanceof Date
        ? before.getTime() === after.getTime()
        : before === after;
    if (!same) changed.push(key);
  }
  const targetsChanged =
    changes.neighborhoodIds !== undefined &&
    [...new Set(changes.neighborhoodIds)].sort().join() !==
      alert.targets
        .map((t) => t.id)
        .sort()
        .join();
  if (targetsChanged) changed.push('neighborhoodIds');

  const data: Prisma.AlertUpdateInput = {
    ...next,
    ...(targetsChanged
      ? {
          neighborhoods: {
            deleteMany: {},
            create: targets.map((t) => ({ neighborhoodId: t.id })),
          },
        }
      : {}),
  };
  const detail: Prisma.InputJsonObject = {
    fields: changed,
    ...(changed.includes('level') ? { level: { before: alert.level, after: next.level } } : {}),
  };
  return { data, changed, detail, scheduledAt: next.scheduledAt };
}

function assertPending(alert: { status: string }) {
  if (alert.status !== 'PENDING_APPROVAL') {
    throw new ServiceError('CONFLICT', 'Cette alerte n’est plus en attente d’approbation.');
  }
}

export async function updateAlert(user: AuthUser, id: string, changes: Partial<AlertChanges>) {
  const alert = await loadAlert(id);
  assertCanIssue(user, alert.type, alert.targets);
  assertPending(alert);
  const { data, changed } = await prepareChanges(user, alert, changes);
  await getPrisma().$transaction(async (tx) => {
    // Mise à jour conditionnelle : une approbation concurrente l'emporte.
    const updated = await tx.alert.updateMany({
      where: { id, status: 'PENDING_APPROVAL' },
      data: { updatedAt: new Date() },
    });
    if (updated.count !== 1) throw new ServiceError('CONFLICT', 'Alerte déjà traitée.');
    await tx.alert.update({ where: { id }, data });
    await recordAudit(
      {
        actorId: user.id,
        action: 'alert.updated',
        entityType: 'alert',
        entityId: id,
        metadata: { fields: changed.join(',') },
      },
      tx,
    );
  });
  return { id };
}

/**
 * Approbation humaine (EXG-29) : l'approbateur peut modifier le message, la zone, le niveau.
 * Sans date programmée future, l'envoi part aussitôt (en simulation par défaut).
 */
export async function approveAlert(
  user: AuthUser,
  id: string,
  input: { changes?: Partial<AlertChanges>; reason?: string },
) {
  const alert = await loadAlert(id);
  assertCanIssue(user, alert.type, alert.targets);
  assertPending(alert);
  const { data, changed, detail, scheduledAt } = await prepareChanges(user, alert, input.changes);
  const scheduled = scheduledAt !== null && scheduledAt.getTime() > Date.now();

  await getPrisma().$transaction(async (tx) => {
    const claimed = await tx.alert.updateMany({
      where: { id, status: 'PENDING_APPROVAL' },
      data: { status: scheduled ? 'SCHEDULED' : 'APPROVED' },
    });
    if (claimed.count !== 1) throw new ServiceError('CONFLICT', 'Alerte déjà traitée.');
    await tx.alert.update({ where: { id }, data });
    await tx.alertApproval.create({
      data: {
        alertId: id,
        approverId: user.id,
        decision: 'APPROVED',
        reason: input.reason ?? null,
        changes: changed.length > 0 ? detail : undefined,
      },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'alert.approved',
        entityType: 'alert',
        entityId: id,
        metadata: { type: alert.type, scheduled, fieldsChanged: changed.join(',') || null },
      },
      tx,
    );
  });

  if (scheduled) return { id, status: 'SCHEDULED' as const, delivery: null };
  const delivery = await dispatchAlert(id, { actorId: user.id });
  return { id, status: 'SENT' as const, delivery };
}

export async function rejectAlert(user: AuthUser, id: string, reason: string) {
  const alert = await loadAlert(id);
  assertCanIssue(user, alert.type, alert.targets);
  assertPending(alert);
  await getPrisma().$transaction(async (tx) => {
    const claimed = await tx.alert.updateMany({
      where: { id, status: 'PENDING_APPROVAL' },
      data: { status: 'REJECTED' },
    });
    if (claimed.count !== 1) throw new ServiceError('CONFLICT', 'Alerte déjà traitée.');
    await tx.alertApproval.create({
      data: { alertId: id, approverId: user.id, decision: 'REJECTED', reason },
    });
    await recordAudit(
      { actorId: user.id, action: 'alert.rejected', entityType: 'alert', entityId: id },
      tx,
    );
  });
  return { id, status: 'REJECTED' as const };
}

/** Annule un brouillon ou une alerte programmée ; lève une alerte envoyée (fin immédiate). */
export async function cancelAlert(user: AuthUser, id: string, reason: string) {
  const alert = await loadAlert(id);
  assertCanIssue(user, alert.type, alert.targets);
  if (!['PENDING_APPROVAL', 'SCHEDULED', 'SENT'].includes(alert.status)) {
    throw new ServiceError('CONFLICT', 'Cette alerte ne peut plus être annulée.');
  }
  await getPrisma().$transaction(async (tx) => {
    const claimed = await tx.alert.updateMany({
      where: { id, status: alert.status },
      data: {
        status: 'CANCELLED',
        ...(alert.status === 'SENT' ? { validUntil: new Date() } : {}),
      },
    });
    if (claimed.count !== 1) throw new ServiceError('CONFLICT', 'Alerte déjà traitée.');
    await recordAudit(
      {
        actorId: user.id,
        action: 'alert.cancelled',
        entityType: 'alert',
        entityId: id,
        metadata: { from: alert.status, reasonLength: reason.length },
      },
      tx,
    );
  });
  return { id, status: 'CANCELLED' as const };
}
