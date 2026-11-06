import { getPrisma } from '@/lib/db';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import { toPublicAlert } from '@/services/alerts/read';
import {
  MAX_SUBSCRIPTIONS_PER_USER,
  type CreateSubscriptionInput,
} from '@/validators/subscriptions';

// Abonnements d'un compte et notifications reçues (CDC §4.2). La position d'un abonnement
// est privée : elle n'apparaît que pour son titulaire.

export async function listMySubscriptions(user: AuthUser) {
  const rows = await getPrisma().subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      lat: true,
      lng: true,
      radiusMeters: true,
      minLevel: true,
      locale: true,
      channelInApp: true,
      channelWebPush: true,
      createdAt: true,
      neighborhoods: { select: { neighborhood: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    neighborhoods: row.neighborhoods.map((n) => n.neighborhood),
    point:
      row.lat !== null && row.lng !== null
        ? { lat: Number(row.lat), lng: Number(row.lng), radiusMeters: row.radiusMeters ?? 0 }
        : null,
    minLevel: row.minLevel,
    locale: row.locale,
    channelInApp: row.channelInApp,
    channelWebPush: row.channelWebPush,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createSubscription(user: AuthUser, input: CreateSubscriptionInput) {
  const prisma = getPrisma();
  const count = await prisma.subscription.count({ where: { userId: user.id } });
  if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
    throw new ServiceError('CONFLICT', `Cinq abonnements au maximum par compte.`);
  }
  if (input.mode === 'neighborhoods') {
    const ids = [...new Set(input.neighborhoodIds)];
    const found = await prisma.neighborhood.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      throw new ServiceError('VALIDATION_ERROR', 'Quartier inconnu.', {
        neighborhoodIds: ['Quartier inconnu.'],
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        userId: user.id,
        minLevel: input.minLevel,
        locale: input.locale,
        channelInApp: input.channelInApp,
        channelWebPush: input.channelWebPush,
        ...(input.mode === 'position'
          ? { lat: input.lat, lng: input.lng, radiusMeters: input.radiusMeters }
          : {
              neighborhoods: {
                create: [...new Set(input.neighborhoodIds)].map((neighborhoodId) => ({
                  neighborhoodId,
                })),
              },
            }),
      },
      select: { id: true },
    });
    await recordAudit(
      {
        actorId: user.id,
        action: 'subscription.created',
        entityType: 'subscription',
        entityId: subscription.id,
        metadata: { mode: input.mode, minLevel: input.minLevel },
      },
      tx,
    );
    return subscription;
  });
}

export async function deleteSubscription(user: AuthUser, id: string) {
  const prisma = getPrisma();
  // Seul le titulaire supprime son abonnement ; sinon « introuvable » (pas d'indice d'existence).
  const deleted = await prisma.subscription.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count !== 1) throw new ServiceError('NOT_FOUND', 'Abonnement introuvable.');
  await recordAudit({
    actorId: user.id,
    action: 'subscription.deleted',
    entityType: 'subscription',
    entityId: id,
  });
  return { deleted: true };
}

/** Notifications reçues (livraisons au compte), les plus récentes d'abord. */
export async function listMyNotifications(user: AuthUser, take = 30) {
  const rows = await getPrisma().alertDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      channel: true,
      status: true,
      mode: true,
      locale: true,
      createdAt: true,
      readAt: true,
      alert: {
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
          sentAt: true,
          isDemo: true,
          neighborhoods: { select: { neighborhood: { select: { name: true } } } },
        },
      },
    },
  });
  // Une carte par alerte, avec ses canaux (dans l'application, notification web…).
  const byAlert = new Map<
    string,
    {
      id: string;
      createdAt: string;
      read: boolean;
      channels: {
        channel: (typeof rows)[number]['channel'];
        status: (typeof rows)[number]['status'];
      }[];
      alert: ReturnType<typeof toPublicAlert>;
    }
  >();
  for (const row of rows) {
    const current = byAlert.get(row.alert.id);
    if (current) {
      current.channels.push({ channel: row.channel, status: row.status });
      current.read &&= row.readAt !== null;
      continue;
    }
    byAlert.set(row.alert.id, {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
      channels: [{ channel: row.channel, status: row.status }],
      alert: toPublicAlert(row.alert),
    });
  }
  return [...byAlert.values()];
}

export async function markNotificationsRead(user: AuthUser) {
  const result = await getPrisma().alertDelivery.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
