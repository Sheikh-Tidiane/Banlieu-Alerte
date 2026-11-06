export type NotificationChannel = 'web_push' | 'sms' | 'whatsapp' | 'email';
export type NotificationMode = 'simulation' | 'live';

export type OutgoingNotification = {
  channel: NotificationChannel;
  /** Destinataire opaque (identifiant d'abonnement), jamais un numéro en clair dans les journaux. */
  recipientRef: string;
  message: string;
};

export type DeliveryResult = {
  status: 'simulated' | 'sent' | 'failed';
  channel: NotificationChannel;
  recipientRef: string;
  at: Date;
  error?: string;
};

export interface NotificationTransport {
  readonly mode: NotificationMode;
  send(notification: OutgoingNotification): Promise<DeliveryResult>;
}
