'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { useAction } from './use-action';

type Rule = {
  scope: string;
  type: 'FLOODING' | 'BLOCKED_DRAIN' | 'WASTE_DUMP' | 'ROAD_CUT' | 'OTHER' | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  targetHours: number;
};

/** Délais de première réponse (administrateur, D-056). */
export function EscalationRulesForm({ rules }: { rules: Rule[] }) {
  const { pending, error, run } = useAction();
  const [values, setValues] = useState(rules);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(
          '/api/admin/escalation-rules',
          'POST',
          {
            rules: values.map(({ type, severity, targetHours }) => ({
              type,
              severity,
              targetHours,
            })),
          },
          translate('escalation.saved'),
        );
      }}
    >
      <ul className="space-y-2">
        {values.map((rule, index) => (
          <li key={rule.scope} className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={rule.targetHours}
                onChange={(e) =>
                  setValues((current) =>
                    current.map((r, i) =>
                      i === index ? { ...r, targetHours: Number(e.target.value) } : r,
                    ),
                  )
                }
                className="min-h-touch rounded-control border-line bg-surface-raised w-20 border-2 px-2"
              />
              <span>{translate('escalation.hours')}</span>
            </label>
            <span>
              {rule.type ? translate(`reportType.${rule.type}`) : translate('escalation.allTypes')}{' '}
              ·{' '}
              {rule.severity
                ? translate(`severity.${rule.severity}`)
                : translate('escalation.allSeverities')}
            </span>
          </li>
        ))}
      </ul>
      {error && <StateBanner kind="error" title={error} />}
      <Button type="submit" variant="outline" disabled={pending}>
        <Save aria-hidden="true" />
        {translate('escalation.save')}
      </Button>
    </form>
  );
}
