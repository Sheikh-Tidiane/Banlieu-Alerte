import { interpolate, translate } from '@/i18n';
import { getPrisma } from '@/lib/db';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { notify } from '@/services/notifications/user-notifications';
import { isTrackingCode } from './tracking-code';

// « Le problème est-il résolu ? » (EXG-32) : seul l'auteur répond, une fois par résolution.
// « Non » rouvre le dossier (Résolu → En cours) et prévient l'agent assigné.

async function loadForFeedback(trackingCode: string) {
  if (!isTrackingCode(trackingCode))
    throw new ServiceError('NOT_FOUND', 'Signalement introuvable.');
  const report = await getPrisma().report.findUnique({
    where: { trackingCode },
    select: {
      id: true,
      trackingCode: true,
      status: true,
      authorId: true,
      assigneeId: true,
      resolutionFeedback: true,
    },
  });
  if (!report) throw new ServiceError('NOT_FOUND', 'Signalement introuvable.');
  return report;
}

export async function getResolutionFeedbackState(user: AuthUser | null, trackingCode: string) {
  const report = await loadForFeedback(trackingCode);
  const isAuthor = Boolean(user && report.authorId === user.id);
  return {
    canAnswer: isAuthor && report.status === 'RESOLVED' && report.resolutionFeedback === null,
    answer: isAuthor ? report.resolutionFeedback : null,
  };
}

export async function answerResolution(user: AuthUser, trackingCode: string, resolved: boolean) {
  const report = await loadForFeedback(trackingCode);
  if (report.authorId !== user.id) {
    throw new ServiceError('FORBIDDEN', 'Seul l’auteur du signalement peut répondre.');
  }
  if (report.status !== 'RESOLVED' || report.resolutionFeedback !== null) {
    throw new ServiceError('CONFLICT', 'Aucune question en attente pour ce signalement.');
  }

  await getPrisma().$transaction(async (tx) => {
    // Mise à jour conditionnelle : une seule réponse par résolution.
    const claimed = await tx.report.updateMany({
      where: { id: report.id, status: 'RESOLVED', resolutionFeedback: null },
      data: resolved
        ? { resolutionFeedback: 'CONFIRMED', resolutionFeedbackAt: new Date() }
        : {
            resolutionFeedback: 'REOPENED',
            resolutionFeedbackAt: new Date(),
            status: 'IN_PROGRESS',
            resolvedAt: null,
          },
    });
    if (claimed.count !== 1) throw new ServiceError('CONFLICT', 'Réponse déjà enregistrée.');

    if (!resolved) {
      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus: 'RESOLVED',
          toStatus: 'IN_PROGRESS',
          changedById: user.id,
          note: translate('followup.reopenedNote'),
        },
      });
      if (report.assigneeId) {
        await notify(
          {
            userId: report.assigneeId,
            kind: 'REPORT_STATUS',
            reportId: report.id,
            title: interpolate(translate('followup.reopenedTitle'), { code: report.trackingCode }),
            link: `/back-office/signalements/${report.trackingCode}`,
          },
          tx,
        );
      }
    }
    // Les notifications « résolu ? » de ce signalement sont traitées.
    await tx.userNotification.updateMany({
      where: { userId: user.id, reportId: report.id, kind: 'RESOLUTION_CHECK', readAt: null },
      data: { readAt: new Date() },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: resolved ? 'report.resolution_confirmed' : 'report.reopened_by_author',
        entityType: 'report',
        entityId: report.id,
      },
      tx,
    );
  });
  return {
    status: resolved ? 'RESOLVED' : 'IN_PROGRESS',
    feedback: resolved ? 'CONFIRMED' : 'REOPENED',
  };
}

/** Signalements de l'auteur en attente de sa réponse « résolu ? ». */
export async function listPendingResolutionChecks(user: AuthUser) {
  return getPrisma().report.findMany({
    where: { authorId: user.id, status: 'RESOLVED', resolutionFeedback: null },
    select: { trackingCode: true, type: true, resolvedAt: true, isDemo: true },
    orderBy: { resolvedAt: 'desc' },
  });
}
