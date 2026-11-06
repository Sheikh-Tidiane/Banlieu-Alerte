import { describe, expect, it } from 'vitest';
import { createNotificationTransport, resolveNotificationMode } from '@/lib/notifications';

describe('notifications (D-006)', () => {
  it('est en mode simulation par défaut', () => {
    expect(resolveNotificationMode(undefined)).toBe('simulation');
    expect(resolveNotificationMode('nimporte')).toBe('simulation');
    expect(createNotificationTransport('simulation').mode).toBe('simulation');
  });

  it('simule un envoi sans rien transmettre', async () => {
    const transport = createNotificationTransport('simulation');
    const result = await transport.send({ channel: 'sms', recipientRef: 'sub_1', message: 'Test' });
    expect(result.status).toBe('simulated');
  });

  it('refuse le mode live sans fournisseur réel branché', () => {
    expect(() => createNotificationTransport('live')).toThrow();
  });
});
