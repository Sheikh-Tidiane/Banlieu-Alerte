import { refreshRisk, type RefreshResult } from '@/services/risk/refresh';
import { dispatchDueAlerts } from '@/services/alerts/dispatch';

// Tâche planifiée toutes les 3 heures (D-048) : recalcul de l'indice puis envoi des
// alertes programmées arrivées à échéance. Les brouillons créés restent en attente.

export async function runRiskJob(
  trigger: 'cron' | 'admin' | 'script',
  actorId: string | null = null,
): Promise<RefreshResult & { scheduledAlertsSent: number }> {
  const result = await refreshRisk({ trigger, actorId });
  const scheduledAlertsSent = await dispatchDueAlerts();
  return { ...result, scheduledAlertsSent };
}
