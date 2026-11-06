'use client';

import { Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { factorLabel } from '@/lib/risk/explain';
import { FACTOR_KEYS, type RuleParams } from '@/lib/risk/types';
import { useAction } from './use-action';

/** Relance la tâche de recalcul (administrateur). */
export function RefreshRiskButton() {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          run('/api/jobs/risk-refresh', 'POST', {}, translate('backoffice.riskAdmin.refreshed'))
        }
      >
        <RefreshCw aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
        {translate('backoffice.riskAdmin.refresh')}
      </Button>
      <p className="text-muted text-sm">{translate('backoffice.riskAdmin.refreshHint')}</p>
      {error && <StateBanner kind="error" title={error} />}
    </div>
  );
}

/** Activation d'une version (y compris un retour à une version précédente). */
export function ActivateVersionButton({ versionId }: { versionId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(
            '/api/admin/rules',
            'POST',
            { action: 'activate', versionId },
            translate('backoffice.riskAdmin.activated'),
          )
        }
      >
        <RotateCcw aria-hidden="true" />
        {translate('backoffice.riskAdmin.activate')}
      </Button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}

const numberInput = 'min-h-touch rounded-control border-line bg-surface-raised w-20 border-2 px-2';

/** Nouvelle version de la grille, à partir de la version active. */
export function NewRuleVersionForm({ base }: { base: RuleParams }) {
  const { pending, error, run } = useAction();
  const [params, setParams] = useState<RuleParams>(base);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [activate, setActivate] = useState(true);
  const total = FACTOR_KEYS.reduce((sum, key) => sum + params.factors[key].maxPoints, 0);

  const setFactor = (
    key: (typeof FACTOR_KEYS)[number],
    patch: Partial<RuleParams['factors'][typeof key]>,
  ) =>
    setParams((p) => ({ ...p, factors: { ...p.factors, [key]: { ...p.factors[key], ...patch } } }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await run(
          '/api/admin/rules',
          'POST',
          { action: 'create', name, ...(notes.trim() ? { notes } : {}), params, activate },
          translate('backoffice.riskAdmin.versionCreated'),
        );
      }}
    >
      <p className="text-muted text-sm">{translate('backoffice.riskAdmin.newVersionHint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-line border-b">
              <th className="py-2 pr-2" scope="col" />
              <th className="py-2 pr-2" scope="col">
                {translate('backoffice.riskAdmin.maxPoints')}
              </th>
              <th className="py-2" scope="col">
                {translate('backoffice.riskAdmin.thresholds')}
              </th>
            </tr>
          </thead>
          <tbody>
            {FACTOR_KEYS.map((key) => {
              const rule = params.factors[key];
              return (
                <tr key={key} className="border-line border-b">
                  <th scope="row" className="py-2 pr-2 font-medium">
                    {factorLabel(key)}
                  </th>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={`${factorLabel(key)} – ${translate('backoffice.riskAdmin.maxPoints')}`}
                      value={rule.maxPoints}
                      onChange={(e) => setFactor(key, { maxPoints: Number(e.target.value) })}
                      className={numberInput}
                    />
                  </td>
                  <td className="flex gap-2 py-2">
                    {rule.thresholds.map((value, i) => (
                      <input
                        key={i}
                        type="number"
                        step="0.1"
                        aria-label={`${factorLabel(key)} – ${i + 1}`}
                        value={value}
                        onChange={(e) => {
                          const thresholds = [...rule.thresholds] as [number, number, number];
                          thresholds[i] = Number(e.target.value);
                          setFactor(key, { thresholds });
                        }}
                        className={numberInput}
                      />
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-2 pr-2">
                {translate('backoffice.riskAdmin.total')}
              </th>
              <td
                className={total === 100 ? 'py-2 font-semibold' : 'text-danger py-2 font-semibold'}
              >
                {total} / 100
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">
          {translate('backoffice.riskAdmin.levels')}
        </legend>
        <div className="flex gap-2">
          {(['moderate', 'high', 'critical'] as const).map((level) => (
            <input
              key={level}
              type="number"
              min={1}
              max={100}
              aria-label={level}
              value={params.levels[level]}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  levels: { ...p.levels, [level]: Number(e.target.value) },
                }))
              }
              className={numberInput}
            />
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1 text-sm font-semibold">
        <span className="block">{translate('backoffice.riskAdmin.noRainCap')}</span>
        <input
          type="number"
          min={0}
          max={100}
          value={params.noRainMaxScore ?? ''}
          onChange={(e) =>
            setParams((p) => ({
              ...p,
              noRainMaxScore: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
          className={numberInput}
        />
      </label>
      <Field label={translate('backoffice.riskAdmin.versionName')}>
        {({ id }) => (
          <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
        )}
      </Field>
      <Field label={translate('backoffice.riskAdmin.versionNotes')}>
        {({ id }) => (
          <Textarea
            id={id}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
          />
        )}
      </Field>
      <label className="min-h-touch flex items-center gap-3">
        <input
          type="checkbox"
          checked={activate}
          onChange={(e) => setActivate(e.target.checked)}
          className="size-5"
        />
        {translate('backoffice.riskAdmin.activateNow')}
      </label>
      {error && <StateBanner kind="error" title={error} />}
      <Button type="submit" disabled={pending || name.trim().length < 3}>
        <Plus aria-hidden="true" />
        {translate('backoffice.riskAdmin.createVersion')}
      </Button>
    </form>
  );
}
