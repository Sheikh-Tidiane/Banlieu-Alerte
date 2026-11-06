import { getPrisma } from '@/lib/db';
import { deliveryLocale, subscriptionMatches } from '@/lib/alerts/matching';
import { createNotificationTransport, type NotificationTransport } from '@/lib/notifications';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';

// Envoi d'une alerte approuvée (D-050) : une livraison par abonnement et par canal.
// Notification dans l'application : réelle (Mon espace). Notification web : couche de
// notifications, en mode simulation par défaut (EXG-17). Un échec n'arrête pas les autres.

export type DispatchSummary = {
  mode: NotificationTransport['mode'];
  matched: number;
  delivered: number;
  simulated: number;
  failed: number;
};

export async function dispatchAlert(
  alertId: string,
  options: { actorId?: string | null; transport?: NotificationTransport } = {},
): Promise<DispatchSummary> {
  const prisma = getPrisma();
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: {
      id: true,
      status: true,
      level: true,
      title: true,
      messageFr: true,
      messageWo: true,
      woReviewed: true,
      neighborhoods: {
        select: {
          neighborhoodId: true,
          neighborhood: {
            select: { landmarks: { select: { lat: true, lng: true, radiusMeters: true } } },
          },
        },
      },
    },
  });
  if (!alert) throw new ServiceError('NOT_FOUND', 'Alerte introuvable.');
  // Garde centrale (EXG-29) : jamais d'envoi sans approbation humaine préalable.
  if (alert.status !== 'APPROVED') {
    throw new ServiceError('CONFLICT', 'Envoi refusé : l’alerte n’est pas approuvée.');
  }

  const transport = options.transport ?? createNotificationTransport();
  const target = {
    level: alert.level,
    neighborhoodIds: alert.neighborhoods.map((n) => n.neighborhoodId),
    landmarks: alert.neighborhoods.flatMap((n) =>
      n.neighborhood.landmarks.map((l) => ({
        lat: Number(l.lat),
        lng: Number(l.lng),
        radiusMeters: l.radiusMeters,
      })),
    ),
  };

  // Échelle du pilote : quelques centaines d'abonnements, filtrés en mémoire.
  const subscriptions = await prisma.subscription.findMany({
    where: { user: { status: 'ACTIVE' } },
    select: {
      id: true,
      userId: true,
      minLevel: true,
      locale: true,
      lat: true,
      lng: true,
      radiusMeters: true,
      channelInApp: true,
      channelWebPush: true,
      neighborhoods: { select: { neighborhoodId: true } },
    },
  });
  const matched = subscriptions.filter((s) =>
    subscriptionMatches(
      {
        minLevel: s.minLevel,
        neighborhoodIds: s.neighborhoods.map((n) => n.neighborhoodId),
        point:
          s.lat !== null && s.lng !== null && s.radiusMeters
            ? { lat: Number(s.lat), lng: Number(s.lng), radiusMeters: s.radiusMeters }
            : null,
      },
      target,
    ),
  );

  const summary: DispatchSummary = {
    mode: transport.mode,
    matched: matched.length,
    delivered: 0,
    simulated: 0,
    failed: 0,
  };
  const rows: {
    alertId: string;
    subscriptionId: string;
    userId: string;
    channel: 'IN_APP' | 'WEB_PUSH';
    status: 'DELIVERED' | 'SIMULATED' | 'FAILED';
    mode: string;
    locale: string;
    error: string | null;
  }[] = [];

  for (const subscription of matched) {
    const locale = deliveryLocale(subscription.locale, alert);
    const base = {
      alertId: alert.id,
      subscriptionId: subscription.id,
      userId: subscription.userId,
      locale,
    };
    if (subscription.channelInApp) {
      rows.push({ ...base, channel: 'IN_APP', status: 'DELIVERED', mode: 'in_app', error: null });
      summary.delivered += 1;
    }
    if (subscription.channelWebPush) {
      try {
        const result = await transport.send({
          channel: 'web_push',
          recipientRef: subscription.id,
          message: `${alert.title} – ${locale === 'wo' && alert.messageWo ? alert.messageWo : alert.messageFr}`,
        });
        const status =
          result.status === 'simulated'
            ? 'SIMULATED'
            : result.status === 'sent'
              ? 'DELIVERED'
              : 'FAILED';
        rows.push({
          ...base,
          channel: 'WEB_PUSH',
          status,
          mode: transport.mode,
          error: result.error ?? null,
        });
        if (status === 'FAILED') summary.failed += 1;
        else if (status === 'SIMULATED') summary.simulated += 1;
        else summary.delivered += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Échec d’envoi';
        rows.push({
          ...base,
          channel: 'WEB_PUSH',
          status: 'FAILED',
          mode: transport.mode,
          error: message,
        });
        summary.failed += 1;
        await prisma.errorLog.create({
          data: {
            source: 'notifications',
            message,
            context: { channel: 'web_push', alertId: alert.id },
          },
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Livraisons idempotentes (alerte, abonnement, canal) : une reprise ne double rien.
    await tx.alertDelivery.createMany({ data: rows, skipDuplicates: true });
    await tx.alert.update({
      where: { id: alert.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    await recordAudit(
      {
        actorId: options.actorId ?? null,
        action: 'alert.sent',
        entityType: 'alert',
        entityId: alert.id,
        metadata: {
          mode: summary.mode,
          matched: summary.matched,
          delivered: summary.delivered,
          simulated: summary.simulated,
          failed: summary.failed,
        },
      },
      tx,
    );
  });
  return summary;
}

/** Alertes programmées arrivées à échéance, et envois interrompus à reprendre. */
export async function dispatchDueAlerts(now = new Date()): Promise<number> {
  const prisma = getPrisma();
  const due = await prisma.alert.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED', scheduledAt: { lte: now } },
        { status: 'APPROVED', updatedAt: { lte: new Date(now.getTime() - 60_000) } },
      ],
    },
    select: { id: true, status: true },
  });
  let sent = 0;
  for (const alert of due) {
    if (alert.status === 'SCHEDULED') {
      const claimed = await prisma.alert.updateMany({
        where: { id: alert.id, status: 'SCHEDULED' },
        data: { status: 'APPROVED' },
      });
      if (claimed.count !== 1) continue;
    }
    await dispatchAlert(alert.id);
    sent += 1;
  }
  return sent;
}
