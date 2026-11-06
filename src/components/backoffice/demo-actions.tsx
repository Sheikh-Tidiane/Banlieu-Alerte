'use client';

import { CloudRain, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StateBanner } from '@/components/ui/states';
import { interpolate, translate } from '@/i18n';

/** Boutons du simulateur (DEMO_MODE, D-063). */
export function DemoActions() {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function call(action: 'simulate-rain' | 'reset') {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/demo/${action}`, { method: 'POST' }).catch(() => null);
    setPending(false);
    const body = (await response?.json().catch(() => null)) as {
      data?: Record<string, number | string>;
      error?: { message: string };
    } | null;
    if (!response?.ok || !body?.data) {
      setMessage({ kind: 'error', text: body?.error?.message ?? translate('design.errorBody') });
      return;
    }
    const d = body.data;
    setMessage({
      kind: 'success',
      text:
        action === 'reset'
          ? interpolate(translate('demo.resetDone'), {
              reports: d.reports ?? 0,
              alerts: d.alerts ?? 0,
              runs: d.runs ?? 0,
            })
          : interpolate(translate('demo.simulated'), {
              reports: d.reports ?? 0,
              drafts: d.draftsCreated ?? 0,
            }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" disabled={pending} onClick={() => call('simulate-rain')}>
          <CloudRain aria-hidden="true" />
          {translate('demo.simulate')}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => call('reset')}>
          <RotateCcw aria-hidden="true" />
          {translate('demo.reset')}
        </Button>
      </div>
      {message && <StateBanner kind={message.kind} title={message.text} />}
    </div>
  );
}
