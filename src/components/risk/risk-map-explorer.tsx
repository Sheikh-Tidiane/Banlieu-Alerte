'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LazyMount } from '@/components/map/lazy-mount';
import { Skeleton, StateBanner } from '@/components/ui/states';
import { translate } from '@/i18n';
import { levelLabel } from '@/lib/risk/explain';
import { RISK_LEVELS, type Horizon } from '@/lib/risk/types';
import { cn } from '@/lib/utils/cn';
import type { RiskCellsData } from '@/services/risk/read';
import { hatchPattern, hatchId } from './hatch';

const RiskMap = dynamic(() => import('@/components/map/risk-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[24rem] w-full rounded-none" />,
});

const dateTime = new Intl.DateTimeFormat('fr-SN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});

/** Légende : couleur, motif et texte pour chaque niveau. */
export function RiskLegend() {
  return (
    <ul className="grid gap-2 sm:grid-cols-5" aria-label={translate('map.legend')}>
      {RISK_LEVELS.map((level) => (
        <li key={level} className="flex items-center gap-2 text-sm">
          <svg width="28" height="20" aria-hidden="true" className="border-line rounded border">
            <defs dangerouslySetInnerHTML={{ __html: hatchPattern(level, 'ba-legend') }} />
            <rect width="28" height="20" fill={`url(#${hatchId(level, 'ba-legend')})`} />
          </svg>
          {levelLabel(level)}
        </li>
      ))}
      <li className="flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="border-muted inline-block h-5 w-7 rounded border border-dashed"
        />
        {levelLabel(null)}
      </li>
    </ul>
  );
}

export function RiskMapExplorer() {
  const [horizon, setHorizon] = useState<Horizon>(24);
  const [result, setResult] = useState<{
    horizon: Horizon;
    data: RiskCellsData | null;
    error: boolean;
  } | null>(null);
  const state: 'loading' | 'ready' | 'error' =
    result?.horizon !== horizon ? 'loading' : result.error ? 'error' : 'ready';

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risk/cells?horizon=${horizon}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { data: RiskCellsData | null };
        setResult({ horizon, data: body.data, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ horizon, data: null, error: true });
      });
    return () => controller.abort();
  }, [horizon]);

  const data = state === 'ready' ? result?.data : null;
  const dataDate = data?.weather.fetchedAt
    ? `${translate('alertsPage.weatherSource')} : ${data.weather.source}, ${translate('alertsPage.weatherFetchedAt')} ${dateTime.format(new Date(data.weather.fetchedAt))} · ${translate('alertsPage.computedAt')} ${dateTime.format(new Date(data.computedAt))}`
    : translate('alertsPage.weatherMissing');

  return (
    <div className="space-y-4">
      <div role="group" aria-label={translate('riskMap.horizon')} className="flex flex-wrap gap-2">
        {([24, 48] as const).map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={horizon === h}
            onClick={() => setHorizon(h)}
            className={cn(
              'min-h-touch rounded-pill border-2 px-4 font-medium',
              horizon === h
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-line bg-surface-raised',
            )}
          >
            {translate(h === 24 ? 'alertsPage.horizon24' : 'alertsPage.horizon48')}
          </button>
        ))}
      </div>
      {state === 'error' && <StateBanner kind="error" title={translate('riskMap.error')} />}
      {state === 'ready' && !data && (
        <StateBanner kind="info" title={translate('alertsPage.riskEmpty')} />
      )}
      {data?.weather.isDemo && (
        <StateBanner kind="info" title={translate('alertsPage.weatherDemo')} />
      )}
      {data?.weather.stale && (
        <StateBanner kind="error" title={translate('alertsPage.weatherStale')} />
      )}
      <p className="text-muted text-sm" data-testid="risk-map-date">
        {state === 'loading' ? translate('map.loading') : dataDate}
      </p>
      <div className="rounded-card border-line bg-surface-raised relative h-[60vh] min-h-[24rem] overflow-hidden border">
        <LazyMount>
          <RiskMap cells={data?.cells ?? []} dataDate={dataDate} />
        </LazyMount>
      </div>
      <section
        aria-labelledby="risk-legend"
        className="rounded-card border-line bg-surface-raised space-y-3 border p-4"
      >
        <h2 id="risk-legend" className="font-semibold">
          {translate('map.legend')}
        </h2>
        <RiskLegend />
        <p className="text-muted text-sm">{translate('riskMap.legendHint')}</p>
      </section>
    </div>
  );
}
