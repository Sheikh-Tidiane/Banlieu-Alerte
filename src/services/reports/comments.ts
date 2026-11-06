import { getPrisma } from '@/lib/db';
import { canModerate } from '@/permissions/policies';
import type { AuthUser, Role } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { isTrackingCode } from './tracking-code';

// Commentaires publics : publiés tout de suite, réservés aux comptes connectés, signalables,
// masquables par la modération (choix de l'équipe). Le nom de l'auteur n'est jamais publié :
// on affiche « Habitant » ou le rôle (minimisation, CDC §11).

export type PublicComment = {
  id: string;
  body: string;
  authorRole: Role | null;
  createdAt: string;
};

export function toPublicComment(comment: {
  id: string;
  body: string;
  createdAt: Date;
  author: { role: Role } | null;
}): PublicComment {
  return {
    id: comment.id,
    body: comment.body,
    authorRole: comment.author?.role ?? null,
    createdAt: comment.createdAt.toISOString(),
  };
}

async function findPublicReport(trackingCode: string) {
  const report = isTrackingCode(trackingCode)
    ? await getPrisma().report.findUnique({
        where: { trackingCode },
        select: { id: true, status: true },
      })
    : null;
  if (!report || report.status === 'REJECTED')
    throw new ServiceError('NOT_FOUND', 'Signalement introuvable.');
  return report;
}

export async function addComment(
  user: AuthUser,
  trackingCode: string,
  body: string,
): Promise<PublicComment> {
  const report = await findPublicReport(trackingCode);
  const comment = await getPrisma().$transaction(async (tx) => {
    const created = await tx.reportComment.create({
      data: { reportId: report.id, authorId: user.id, body },
      select: { id: true, body: true, createdAt: true, author: { select: { role: true } } },
    });
    await recordAudit(
      { actorId: user.id, action: 'comment.created', entityType: 'comment', entityId: created.id },
      tx,
    );
    return created;
  });
  return toPublicComment(comment);
}

/** Signaler un commentaire : ouvert à tous, limité en débit par la route. */
export async function flagComment(commentId: string, reason: string, reporterId: string | null) {
  const comment = await getPrisma().reportComment.findUnique({
    where: { id: commentId },
    select: { id: true, isInternal: true, status: true },
  });
  if (!comment || comment.isInternal || comment.status !== 'PUBLISHED') {
    throw new ServiceError('NOT_FOUND', 'Commentaire introuvable.');
  }
  await getPrisma().abuseFlag.create({ data: { commentId, reason, reporterId } });
  return { flagged: true };
}

export async function setCommentHidden(user: AuthUser, commentId: string, hidden: boolean) {
  const prisma = getPrisma();
  const comment = await prisma.reportComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      isInternal: true,
      report: {
        select: {
          status: true,
          neighborhoodId: true,
          neighborhood: { select: { communeId: true } },
        },
      },
    },
  });
  if (!comment || comment.isInternal)
    throw new ServiceError('NOT_FOUND', 'Commentaire introuvable.');
  if (!canModerate(user, comment.report))
    throw new ServiceError('FORBIDDEN', 'Modération non autorisée.');
  await prisma.$transaction(async (tx) => {
    await tx.reportComment.update({
      where: { id: commentId },
      data: { status: hidden ? 'HIDDEN' : 'PUBLISHED' },
    });
    if (hidden) {
      await tx.abuseFlag.updateMany({
        where: { commentId, status: 'OPEN' },
        data: { status: 'ACTIONED' },
      });
    }
    await recordAudit(
      {
        actorId: user.id,
        action: hidden ? 'comment.hidden' : 'comment.restored',
        entityType: 'comment',
        entityId: commentId,
      },
      tx,
    );
  });
  return { hidden };
}
