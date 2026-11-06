'use client';

import { Check, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';

type State = 'unknown' | 'ask' | 'confirmed' | 'reopened' | 'hidden';

/**
 * « Le problème est-il résolu ? » (EXG-32), affiché seulement à l'auteur connecté d'un
 * signalement résolu. Sur la page publique, l'état est demandé à l'API : la page reste
 * identique pour tous et peut être mise en cache sans donnée personnelle.
 */
const answeredKey = (code: string) => `ba-resolution-${code}`;

/** Réponse donnée dans cet onglet : réaffichée si le composant est remonté au rafraîchissement. */
function readAnswered(code: string): State | null {
  try {
    const value = sessionStorage.getItem(answeredKey(code));
    return value === 'confirmed' || value === 'reopened' ? value : null;
  } catch {
    return null;
  }
}

export function ResolutionQuestion({ code, known = false }: { code: string; known?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>(known ? 'ask' : 'unknown');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const answered = readAnswered(code);
    if (answered) {
      // Confirmation affichée une fois, même si le rafraîchissement a remonté le composant.
      const timer = setTimeout(() => setState(answered), 0);
      try {
        sessionStorage.removeItem(answeredKey(code));
      } catch {
        // Stockage indisponible : rien à nettoyer.
      }
      return () => clearTimeout(timer);
    }
    if (known) return;
    const controller = new AbortController();
    fetch(`/api/reports/${code}/feedback`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { data?: { canAnswer: boolean } };
        setState((current) =>
          current === 'confirmed' || current === 'reopened'
            ? current
            : body.data?.canAnswer
              ? 'ask'
              : 'hidden',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('hidden');
      });
    return () => controller.abort();
  }, [code, known]);

  async function answer(resolved: boolean) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/reports/${code}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    }).catch(() => null);
    setPending(false);
    if (response?.ok) {
      const result = resolved ? 'confirmed' : 'reopened';
      try {
        sessionStorage.setItem(answeredKey(code), result);
      } catch {
        // Stockage indisponible : la confirmation reste affichée tant que le composant vit.
      }
      setState(result);
      router.refresh();
      return;
    }
    const payload = (await response?.json().catch(() => null)) as {
      error?: { message: string };
    } | null;
    setError(payload?.error?.message ?? translate('design.errorBody'));
  }

  if (state === 'unknown' || state === 'hidden') return null;
  if (state === 'confirmed' || state === 'reopened') {
    return (
      <StateBanner
        kind="success"
        title={translate(
          state === 'confirmed' ? 'followup.thanksConfirmed' : 'followup.thanksReopened',
        )}
      />
    );
  }
  return (
    <div
      className="rounded-card border-accent bg-accent/15 space-y-3 border-2 p-4"
      data-testid="resolution-question"
    >
      <p className="font-heading text-lg font-semibold">{translate('followup.question')}</p>
      <p className="text-sm">{translate('followup.questionHint')}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={() => answer(true)}>
          <Check aria-hidden="true" />
          {translate('followup.yes')}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => answer(false)}>
          <RotateCcw aria-hidden="true" />
          {translate('followup.no')}
        </Button>
      </div>
      {error && <StateBanner kind="error" title={error} />}
    </div>
  );
}
