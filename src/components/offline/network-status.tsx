'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useToast } from '@/components/ui/toast';
import { flushQueue, listQueuedReports, onQueueChange } from '@/lib/offline/queue';
import { translate } from '@/i18n';

const RETRY_INTERVAL_MS = 15_000;

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * Indicateur réseau et file d'attente (EXG-04) : bandeau hors-ligne, nombre de
 * signalements en attente, envoi automatique au retour du réseau et à l'ouverture.
 */
export function NetworkStatus() {
  const toast = useToast();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // Plusieurs déclencheurs peuvent rejoindre le même envoi : une seule notification par envoi.
  const notified = useRef(new WeakSet<object>());

  const report = useCallback(
    (result: { sent: number; rejected: number }) => {
      if (notified.current.has(result)) return;
      notified.current.add(result);
      if (result.sent > 0) toast(translate('offline.synced'));
      if (result.rejected > 0) toast(translate('offline.failed'), 'error');
    },
    [toast],
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const queued = await listQueuedReports().catch(() => []);
      if (!cancelled) setPending(queued.filter((entry) => !entry.rejected).length);
    };
    const flush = async () => {
      if (!navigator.onLine) return;
      const queued = await listQueuedReports().catch(() => []);
      if (!queued.some((entry) => !entry.rejected)) return;
      setSyncing(true);
      const result = await flushQueue();
      setSyncing(false);
      report(result);
    };
    const goOnline = () => void flush();

    void refresh();
    void flush();
    const unsubscribe = onQueueChange(() => void refresh());
    window.addEventListener('online', goOnline);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', goOnline);
    };
  }, [report]);

  // Nouvelle tentative régulière tant que des signalements attendent (envoi interrompu).
  useEffect(() => {
    if (!online || pending === 0) return;
    const timer = window.setInterval(() => {
      void flushQueue().then(report);
    }, RETRY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [online, pending, report]);

  if (online && pending === 0 && !syncing) return null;

  return (
    <div role="status" className="bg-ink text-surface" data-testid="network-status">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        {!online && (
          <p className="flex items-center gap-2 font-semibold">
            <WifiOff aria-hidden="true" className="size-4" />
            {translate('offline.offline')}
            <span className="font-normal opacity-80">{translate('offline.offlineHint')}</span>
          </p>
        )}
        {(pending > 0 || syncing) && (
          <p className="flex items-center gap-2">
            <RefreshCw aria-hidden="true" className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? translate('offline.syncing') : `${pending} ${translate('offline.pending')}`}
          </p>
        )}
      </div>
    </div>
  );
}
