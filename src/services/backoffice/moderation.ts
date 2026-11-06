import { revokeAllSessions } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import { canBlockUsers, canModerate } from '@/permissions/policies';
import { reportScopeWhere } from '@/permissions/scope';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';

// File de modération : abus signalés sur les signalements et commentaires de la portée.

export async function listOpenAbuse(user: AuthUser) {
  const scope = reportScopeWhere(user);
  const flags = await getPrisma().abuseFlag.findMany({
    where: { status: 'OPEN', OR: [{ report: scope }, { comment: { report: scope } }] },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      report: {
        select: { trackingCode: true, type: true, status: true, description: true, isDemo: true },
      },
      comment: {
        select: {
          id: true,
          body: true,
          status: true,
          authorId: true,
          report: { select: { trackingCode: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return flags.map((flag) => ({
    ...flag,
    comment: flag.comment
      ? { ...flag.comment, hasAuthor: flag.comment.authorId !== null, authorId: undefined }
      : null,
  }));
}

async function findFlagReport(flagId: string) {
  const flag = await getPrisma().abuseFlag.findUnique({
    where: { id: flagId },
    select: {
      id: true,
      status: true,
      report: {
        select: {
          status: true,
          neighborhoodId: true,
          neighborhood: { select: { communeId: true } },
        },
      },
      comment: {
        select: {
          authorId: true,
          report: {
            select: {
              status: true,
              neighborhoodId: true,
              neighborhood: { select: { communeId: true } },
            },
          },
        },
      },
    },
  });
  const report = flag?.report ?? flag?.comment?.report;
  if (!flag || !report) throw new ServiceError('NOT_FOUND', 'Signalement d’abus introuvable.');
  return { flag, report };
}

/** Classer sans suite. */
export async function dismissAbuse(user: AuthUser, flagId: string) {
  const { flag, report } = await findFlagReport(flagId);
  if (!canModerate(user, report)) throw new ServiceError('FORBIDDEN', 'Modération non autorisée.');
  if (flag.status !== 'OPEN') throw new ServiceError('CONFLICT', 'Déjà traité.');
  await getPrisma().abuseFlag.update({ where: { id: flagId }, data: { status: 'DISMISSED' } });
  await recordAudit({
    actorId: user.id,
    action: 'abuse.dismissed',
    entityType: 'abuse_flag',
    entityId: flagId,
  });
  return { dismissed: true };
}

/** Bloquer l'auteur d'un commentaire signalé (administrateur) : son identité n'est pas exposée. */
export async function blockCommentAuthor(user: AuthUser, flagId: string) {
  if (!canBlockUsers(user))
    throw new ServiceError('FORBIDDEN', 'Action réservée à l’administrateur.');
  const { flag } = await findFlagReport(flagId);
  const authorId = flag.comment?.authorId;
  if (!authorId)
    throw new ServiceError('VALIDATION_ERROR', 'Aucun compte à bloquer pour ce signalement.');
  if (authorId === user.id)
    throw new ServiceError('VALIDATION_ERROR', 'Vous ne pouvez pas bloquer votre propre compte.');
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: authorId }, data: { status: 'BLOCKED' } });
    await tx.reportComment.updateMany({ where: { authorId }, data: { status: 'HIDDEN' } });
    await tx.abuseFlag.update({ where: { id: flagId }, data: { status: 'ACTIONED' } });
    await recordAudit(
      { actorId: user.id, action: 'user.blocked', entityType: 'user', entityId: authorId },
      tx,
    );
  });
  await revokeAllSessions(authorId);
  return { blocked: true };
}
