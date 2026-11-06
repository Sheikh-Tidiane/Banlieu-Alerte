'use client';

import { createStore, del, entries, set } from 'idb-keyval';

// File d'attente hors-ligne des signalements (D-027), dans IndexedDB.
// Chaque entrée porte un clientId : le serveur l'utilise comme clé d'idempotence,
// donc un envoi rejoué ne crée jamais de doublon.

export type QueuedReport = {
  clientId: string;
  fields: Record<string, string>;
  photo?: Blob;
  queuedAt: number;
  /** Dernière erreur définitive (refus de validation) : l'entrée n'est plus renvoyée. */
  rejected?: string;
};

export type SubmitResult =
  | { kind: 'sent'; trackingCode: string }
  | { kind: 'duplicate'; duplicates: string[] }
  | { kind: 'invalid'; message: string; details?: Record<string, string[]> }
  | { kind: 'rate-limited'; message: string }
  | { kind: 'network' };

const QUEUE_EVENT = 'ba-queue-change';
/** Au-delà, l'envoi est abandonné et le signalement reste en file (réseau instable). */
const SUBMIT_TIMEOUT_MS = 30_000;
let store: ReturnType<typeof createStore> | null = null;

function queueStore() {
  store ??= createStore('banlieue-alerte', 'report-queue');
  return store;
}

function notify() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function onQueueChange(listener: () => void) {
  window.addEventListener(QUEUE_EVENT, listener);
  return () => window.removeEventListener(QUEUE_EVENT, listener);
}

export function toFormData(fields: Record<string, string>, photo?: Blob): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (photo) form.append('photo', photo, 'photo.jpg');
  return form;
}

/** Envoie un signalement ; distingue l'absence de réseau des refus du serveur. */
export async function submitReport(
  fields: Record<string, string>,
  photo?: Blob,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch('/api/reports', {
      method: 'POST',
      body: toFormData(fields, photo),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'network' };
  }
  const body = (await response.json().catch(() => null)) as {
    data?: { trackingCode: string };
    error?: { message: string; details?: Record<string, string[]> };
  } | null;
  if (response.ok && body?.data) return { kind: 'sent', trackingCode: body.data.trackingCode };
  if (response.status === 409)
    return { kind: 'duplicate', duplicates: body?.error?.details?.duplicates ?? [] };
  if (response.status === 429) return { kind: 'rate-limited', message: body?.error?.message ?? '' };
  if (response.status >= 500 || !body) return { kind: 'network' };
  return { kind: 'invalid', message: body.error?.message ?? '', details: body.error?.details };
}

export async function enqueueReport(entry: Omit<QueuedReport, 'queuedAt'>) {
  await set(
    entry.clientId,
    { ...entry, queuedAt: Date.now() } satisfies QueuedReport,
    queueStore(),
  );
  notify();
}

export async function listQueuedReports(): Promise<QueuedReport[]> {
  const all = await entries<string, QueuedReport>(queueStore());
  return all.map(([, value]) => value).sort((a, b) => a.queuedAt - b.queuedAt);
}

let flushing: Promise<{ sent: number; rejected: number }> | null = null;

/**
 * Renvoie la file, dans l'ordre. S'arrête au premier échec réseau. Un doublon proche
 * n'arrête pas l'envoi : l'habitant n'est plus là pour trancher, le signalement est
 * envoyé et la détection est laissée aux délégués (confirmNotDuplicate).
 */
export function flushQueue(): Promise<{ sent: number; rejected: number }> {
  flushing ??= (async () => {
    let sent = 0;
    let rejected = 0;
    try {
      for (const entry of await listQueuedReports()) {
        if (entry.rejected) continue;
        const result = await submitReport(
          { ...entry.fields, confirmNotDuplicate: 'true' },
          entry.photo,
        );
        if (result.kind === 'network' || result.kind === 'rate-limited') break;
        if (result.kind === 'sent') {
          await del(entry.clientId, queueStore());
          sent += 1;
        } else {
          await set(
            entry.clientId,
            { ...entry, rejected: result.kind === 'invalid' ? result.message : 'refusé' },
            queueStore(),
          );
          rejected += 1;
        }
      }
    } finally {
      flushing = null;
      notify();
    }
    return { sent, rejected };
  })();
  return flushing;
}
