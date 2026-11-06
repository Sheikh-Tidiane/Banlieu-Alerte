'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

type ApiError = { error?: { message: string; details?: Record<string, string[]> } };

/** Envoie une action du back-office ; renvoie le message d'erreur éventuel. */
export async function send(
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    const details = payload?.error?.details;
    return (details && Object.values(details)[0]?.[0]) ?? payload?.error?.message ?? 'Erreur';
  } catch {
    return translate('design.errorBody');
  }
}

/** Action du back-office : envoi, message de succès, rafraîchissement, erreur. */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(url: string, method: 'POST' | 'PATCH', body: unknown, success: string) {
    setPending(true);
    setError(null);
    const message = await send(url, method, body);
    setPending(false);
    if (message) {
      setError(message);
      return false;
    }
    toast(success);
    router.refresh();
    return true;
  }
  return { pending, error, run };
}
