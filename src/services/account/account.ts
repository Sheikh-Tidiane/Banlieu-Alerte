import { revokeAllSessions } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { toPublicSummary } from '@/services/reports/public';

// Espace citoyen : mes signalements, profil, export et suppression (D-039, loi sénégalaise
// sur les données personnelles : accès, rectification, effacement).

export async function listMyReports(user: AuthUser) {
  const rows = await getPrisma().report.findMany({
    where: { authorId: user.id },
    select: {
      trackingCode: true,
      type: true,
      severity: true,
      status: true,
      lat: true,
      lng: true,
      confirmationCount: true,
      createdAt: true,
      isDemo: true,
      neighborhood: { select: { id: true, name: true } },
      _count: { select: { photos: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPublicSummary);
}

export async function updateProfile(
  user: AuthUser,
  input: { name?: string; locale?: 'fr' | 'wo'; notifyStatusChanges?: boolean },
) {
  await getPrisma().user.update({ where: { id: user.id }, data: input });
  return { updated: true };
}

/** Toutes les données liées au compte, lisibles par l'habitant (JSON). */
export async function exportMyData(user: AuthUser) {
  const data = await getPrisma().user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      role: true,
      locale: true,
      notifyStatusChanges: true,
      createdAt: true,
      notifications: { select: { kind: true, title: true, createdAt: true, readAt: true } },
      feedbackPrompts: {
        select: { answer: true, answeredAt: true, episode: { select: { name: true } } },
      },
      reports: {
        select: {
          trackingCode: true,
          type: true,
          severity: true,
          description: true,
          lat: true,
          lng: true,
          status: true,
          createdAt: true,
          neighborhood: { select: { name: true } },
          photos: { select: { storageKey: true, createdAt: true } },
        },
      },
      comments: {
        where: { isInternal: false },
        select: {
          body: true,
          status: true,
          createdAt: true,
          report: { select: { trackingCode: true } },
        },
      },
      sessions: { select: { createdAt: true, lastSeenAt: true, expiresAt: true } },
      subscriptions: {
        select: {
          lat: true,
          lng: true,
          radiusMeters: true,
          minLevel: true,
          locale: true,
          channelInApp: true,
          channelWebPush: true,
          createdAt: true,
          neighborhoods: { select: { neighborhood: { select: { name: true } } } },
        },
      },
      alertDeliveries: {
        select: {
          channel: true,
          status: true,
          mode: true,
          createdAt: true,
          readAt: true,
          alert: { select: { title: true } },
        },
      },
    },
  });
  await recordAudit({
    actorId: user.id,
    action: 'account.exported',
    entityType: 'user',
    entityId: user.id,
  });
  return {
    exportedAt: new Date().toISOString(),
    notice:
      'Données de votre compte Banlieue Alerte. Les votes « Je vois aussi » ne sont pas reliés à votre compte (empreinte d’appareil uniquement).',
    account: {
      name: data.name,
      email: data.email,
      role: data.role,
      locale: data.locale,
      createdAt: data.createdAt,
    },
    reports: data.reports.map((r) => ({
      ...r,
      lat: Number(r.lat),
      lng: Number(r.lng),
      photos: r.photos.map((p) => ({ url: `/api/photos/${p.storageKey}`, createdAt: p.createdAt })),
    })),
    comments: data.comments,
    sessions: data.sessions,
  };
}

/**
 * Suppression du compte (choix de l'équipe) : données personnelles effacées, signalements
 * conservés sans auteur pour le suivi du quartier, commentaires anonymisés.
 */
export async function deleteMyAccount(user: AuthUser) {
  if (user.role !== 'CITIZEN') {
    throw new ServiceError(
      'FORBIDDEN',
      'Un compte délégué, agent ou administrateur est fermé par un administrateur (traçabilité des actions).',
    );
  }
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.report.updateMany({ where: { authorId: user.id }, data: { authorId: null } });
    await tx.reportComment.updateMany({ where: { authorId: user.id }, data: { authorId: null } });
    await tx.reportVote.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.abuseFlag.updateMany({ where: { reporterId: user.id }, data: { reporterId: null } });
    await tx.passwordReset.deleteMany({ where: { userId: user.id } });
    // Abonnements (position privée) supprimés ; notifications reçues détachées du compte.
    await tx.subscription.deleteMany({ where: { userId: user.id } });
    await tx.alertDelivery.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: 'Compte supprimé',
        email: null,
        passwordHash: null,
        phoneHash: null,
        status: 'DELETED',
      },
    });
    // L'auteur reste le compte lui-même, déjà anonymisé : aucune donnée personnelle conservée.
    await recordAudit(
      { actorId: user.id, action: 'account.deleted', entityType: 'user', entityId: user.id },
      tx,
    );
  });
  await revokeAllSessions(user.id);
  return { deleted: true };
}
