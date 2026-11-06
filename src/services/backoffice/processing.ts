import { interpolate, translate } from '@/i18n';
import { getPrisma } from '@/lib/db';
import { canAddNote, canAssign, canChangeStatus, canMerge } from '@/permissions/policies';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { notify } from '@/services/notifications/user-notifications';
import type { ReportStatus } from '@/validators/report';
import { findScopedReport } from './reports';

// Actions de traitement (EXG-07, D-037, D-038). Chaque action écrit l'historique et le
// journal d'audit dans la même transaction que la modification.

export async function changeStatus(
  user: AuthUser,
  trackingCode: string,
  to: ReportStatus,
  reason?: string,
) {
  const report = await findScopedReport(user, trackingCode, {
    trackingCode: true,
    author: { select: { id: true, status: true, notifyStatusChanges: true } },
  });
  if (!canChangeStatus(user, report, to)) {
    throw new ServiceError('FORBIDDEN', 'Ce changement de statut n’est pas autorisé.');
  }
  if (to === 'REJECTED' && !reason) {
    throw new ServiceError('VALIDATION_ERROR', 'Motif obligatoire pour un rejet.', {
      reason: ['Motif obligatoire pour un rejet.'],
    });
  }
  await getPrisma().$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: {
        status: to,
        resolvedAt: to === 'RESOLVED' ? new Date() : null,
        // Retour à « Nouveau » ou « Vérifié » : l'assignation n'a plus de sens.
        ...(to === 'NEW' || to === 'VERIFIED' ? { assigneeId: null } : {}),
        // Nouvelle résolution : la question « résolu ? » est reposée à l'auteur.
        ...(to === 'RESOLVED' ? { resolutionFeedback: null, resolutionFeedbackAt: null } : {}),
      },
    });
    // Retour au citoyen (EXG-32) : seulement avec son consentement (D-055).
    const author = report.author;
    if (
      author &&
      author.id !== user.id &&
      author.status === 'ACTIVE' &&
      author.notifyStatusChanges
    ) {
      const status = translate(`reportStatus.${to}`);
      await notify(
        {
          userId: author.id,
          kind: to === 'RESOLVED' ? 'RESOLUTION_CHECK' : 'REPORT_STATUS',
          reportId: report.id,
          title: interpolate(
            translate(to === 'RESOLVED' ? 'followup.resolvedTitle' : 'followup.statusTitle'),
            { code: report.trackingCode, status: status.toLowerCase() },
          ),
          body: to === 'RESOLVED' ? translate('followup.resolvedBody') : (reason ?? null),
          link: `/signalements/${report.trackingCode}`,
        },
        tx,
      );
    }
    await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        fromStatus: report.status,
        toStatus: to,
        changedById: user.id,
        note: reason ?? null,
      },
    });
    // Un signalement rejeté clôt les abus ouverts qui le visaient.
    if (to === 'REJECTED') {
      await tx.abuseFlag.updateMany({
        where: { reportId: report.id, status: 'OPEN' },
        data: { status: 'ACTIONED' },
      });
    }
    await recordAudit(
      {
        actorId: user.id,
        action: 'report.status_changed',
        entityType: 'report',
        entityId: report.id,
        metadata: { from: report.status, to },
      },
      tx,
    );
  });
  return { status: to };
}

export async function assignReport(
  user: AuthUser,
  trackingCode: string,
  assigneeId: string | null,
) {
  const report = await findScopedReport(user, trackingCode, { assigneeId: true });
  if (!canAssign(user, report)) throw new ServiceError('FORBIDDEN', 'Assignation non autorisée.');

  if (assigneeId) {
    const assignee = await getPrisma().user.findUnique({
      where: { id: assigneeId },
      select: { role: true, status: true, communeId: true },
    });
    const communeId = report.neighborhood?.communeId ?? null;
    if (!assignee || assignee.role !== 'AGENT' || assignee.status !== 'ACTIVE') {
      throw new ServiceError('VALIDATION_ERROR', 'Seul un agent actif peut être assigné.');
    }
    if (communeId && assignee.communeId !== communeId) {
      throw new ServiceError(
        'VALIDATION_ERROR',
        'Cet agent ne couvre pas la commune du signalement.',
      );
    }
  }

  // Assigner un signalement vérifié le fait passer à « Assigné ».
  const nextStatus: ReportStatus | null =
    assigneeId && report.status === 'VERIFIED' ? 'ASSIGNED' : null;
  await getPrisma().$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: { assigneeId, ...(nextStatus ? { status: nextStatus } : {}) },
    });
    if (nextStatus) {
      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus: report.status,
          toStatus: nextStatus,
          changedById: user.id,
        },
      });
    }
    await recordAudit(
      {
        actorId: user.id,
        action: 'report.assigned',
        entityType: 'report',
        entityId: report.id,
        metadata: { assigneeId, previousAssigneeId: report.assigneeId },
      },
      tx,
    );
  });
  return { assigneeId, status: nextStatus ?? report.status };
}

export async function addInternalNote(user: AuthUser, trackingCode: string, body: string) {
  const report = await findScopedReport(user, trackingCode, {});
  if (!canAddNote(user, report)) throw new ServiceError('FORBIDDEN', 'Ajout de note non autorisé.');
  const note = await getPrisma().$transaction(async (tx) => {
    const created = await tx.reportComment.create({
      data: { reportId: report.id, authorId: user.id, body, isInternal: true },
      select: { id: true },
    });
    await recordAudit(
      { actorId: user.id, action: 'report.note_added', entityType: 'report', entityId: report.id },
      tx,
    );
    return created;
  });
  return { noteId: note.id };
}

/**
 * Fusion d'un doublon (D-038) : le doublon est rejeté avec un renvoi vers le principal ;
 * ses confirmations (et le doublon lui-même) comptent pour le principal.
 */
export async function mergeReport(user: AuthUser, trackingCode: string, primaryCode: string) {
  if (trackingCode === primaryCode) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      'Un signalement ne peut pas être son propre doublon.',
    );
  }
  const duplicate = await findScopedReport(user, trackingCode, { duplicateOfId: true });
  const primary = await findScopedReport(user, primaryCode, { duplicateOfId: true });
  if (!canMerge(user, duplicate, primary))
    throw new ServiceError('FORBIDDEN', 'Fusion non autorisée.');
  if (duplicate.duplicateOfId)
    throw new ServiceError('CONFLICT', 'Ce signalement est déjà fusionné.');
  if (primary.duplicateOfId || primary.status === 'REJECTED') {
    throw new ServiceError('VALIDATION_ERROR', 'Le signalement principal doit être actif.');
  }

  await getPrisma().$transaction(async (tx) => {
    const primaryKeys = new Set(
      (
        await tx.reportVote.findMany({
          where: { reportId: primary.id },
          select: { voterKey: true },
        })
      ).map((vote) => vote.voterKey),
    );
    const votes = await tx.reportVote.findMany({
      where: { reportId: duplicate.id },
      select: { id: true, voterKey: true },
    });
    const movable = votes.filter((vote) => !primaryKeys.has(vote.voterKey));
    if (movable.length > 0) {
      await tx.reportVote.updateMany({
        where: { id: { in: movable.map((v) => v.id) } },
        data: { reportId: primary.id },
      });
    }
    await tx.report.update({
      where: { id: primary.id },
      data: { confirmationCount: { increment: movable.length + 1 } },
    });
    await tx.report.update({
      where: { id: duplicate.id },
      data: { status: 'REJECTED', duplicateOfId: primary.id, assigneeId: null, resolvedAt: null },
    });
    await tx.reportStatusHistory.create({
      data: {
        reportId: duplicate.id,
        fromStatus: duplicate.status,
        toStatus: 'REJECTED',
        changedById: user.id,
        note: `Doublon de ${primaryCode}`,
      },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'report.merged',
        entityType: 'report',
        entityId: duplicate.id,
        metadata: { primaryId: primary.id, movedVotes: movable.length },
      },
      tx,
    );
  });
  return { primaryCode };
}
