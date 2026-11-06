import type {
  DeliveryResult,
  NotificationMode,
  NotificationTransport,
  OutgoingNotification,
} from './types';

export type * from './types';

/**
 * Transport de simulation (mode par défaut, D-006) : rien n'est envoyé, chaque envoi est
 * conservé en mémoire et peut être journalisé. Aucun fournisseur réel n'est branché
 * en Phase 1 : le mode « live » n'est accepté qu'avec un transport réel testé.
 */
export class SimulatedTransport implements NotificationTransport {
  readonly mode = 'simulation' as const;
  readonly outbox: DeliveryResult[] = [];

  async send(notification: OutgoingNotification): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      status: 'simulated',
      channel: notification.channel,
      recipientRef: notification.recipientRef,
      at: new Date(),
    };
    this.outbox.push(result);
    return result;
  }
}

export function resolveNotificationMode(value = process.env.NOTIFICATIONS_MODE): NotificationMode {
  return value === 'live' ? 'live' : 'simulation';
}

/** Choisit le transport selon NOTIFICATIONS_MODE. Le mode actif doit toujours être affiché. */
export function createNotificationTransport(
  mode: NotificationMode = resolveNotificationMode(),
): NotificationTransport {
  if (mode === 'live') {
    throw new Error(
      "NOTIFICATIONS_MODE=live : aucun fournisseur réel n'est configuré. Restez en mode simulation.",
    );
  }
  return new SimulatedTransport();
}
