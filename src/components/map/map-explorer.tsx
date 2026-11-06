'use client';

import { ListFilter, LocateFixed, Maximize, Minimize } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton, StateBanner } from '@/components/ui/states';
import type { PublicReportSummary } from '@/services/reports/public';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';
import { LazyMount } from './lazy-mount';
import { REPORT_STATUSES, REPORT_TYPES, SEVERITIES } from '@/lib/reports/constants';

const ReportsMap = dynamic(() => import('./reports-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[24rem] w-full rounded-none" />,
});

type Neighborhood = { id: string; name: string };
type Filters = {
  type: string[];
  status: string[];
  severity: string[];
  days: string;
  neighborhoodId: string;
};
const EMPTY_FILTERS: Filters = { type: [], status: [], severity: [], days: '', neighborhoodId: '' };

function toQuery(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.type.length) params.set('type', filters.type.join(','));
  if (filters.status.length) params.set('status', filters.status.join(','));
  if (filters.severity.length) params.set('severity', filters.severity.join(','));
  if (filters.days) params.set('days', filters.days);
  if (filters.neighborhoodId) params.set('neighborhoodId', filters.neighborhoodId);
  return params.toString();
}

function ChipGroup({
  label,
  values,
  selected,
  render,
  onToggle,
}: {
  label: string;
  values: readonly string[];
  selected: string[];
  render: (value: string) => React.ReactNode;
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(value)}
              className={cn(
                'min-h-touch rounded-pill flex items-center gap-1.5 border-2 px-3 text-sm font-medium [&_svg]:size-4',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-line bg-surface-raised',
              )}
            >
              {render(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const dateFormatter = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' });

/** Résumé en mots : décompte par type et signalements les plus récents. */
function ReportsSummary({ reports }: { reports: PublicReportSummary[] }) {
  if (reports.length === 0) return null;
  const byType = REPORT_TYPES.map((type) => ({
    type,
    count: reports.filter((r) => r.type === type).length,
  })).filter((t) => t.count > 0);
  const recent = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  return (
    <section
      aria-labelledby="map-summary"
      className="rounded-card border-line bg-surface-raised grid min-h-[19rem] gap-4 border p-4 sm:min-h-44 sm:grid-cols-2"
    >
      <div>
        <h2 id="map-summary" className="font-semibold">
          {translate('map.summaryTitle')}
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {byType.map(({ type, count }) => (
            <li key={type} className="flex items-center gap-2">
              <ReportTypeIcon type={type} className="text-water size-4" />
              <span className="font-semibold">{count}</span> {translate(`reportType.${type}`)}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-semibold">{translate('map.recent')}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {recent.map((report) => (
            <li key={report.trackingCode}>
              <Link
                href={`/signalements/${report.trackingCode}`}
                className="text-primary min-h-touch inline-flex items-center underline"
              >
                {translate(`reportType.${report.type}`)} ·{' '}
                {report.neighborhood?.name ?? translate('map.unidentified')} ·{' '}
                {dateFormatter.format(new Date(report.createdAt))}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Carte interactive : filtres, légende, géolocalisation, plein écran (CDC §4.1). */
export function MapExplorer({ neighborhoods }: { neighborhoods: Neighborhood[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [result, setResult] = useState<{
    query: string;
    reports: PublicReportSummary[];
    error: boolean;
  } | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const query = useMemo(() => toQuery(filters), [filters]);
  // Tant que le résultat affiché ne correspond pas aux filtres courants, on charge.
  const state: 'loading' | 'ready' | 'error' =
    result?.query !== query ? 'loading' : result.error ? 'error' : 'ready';
  const reports = useMemo(() => result?.reports ?? [], [result]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/reports${query ? `?${query}` : ''}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { data: PublicReportSummary[] };
        setResult({ query, reports: body.data, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult((current) => ({ query, reports: current?.reports ?? [], error: true }));
      });
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggle(key: 'type' | 'status' | 'severity', value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((v) => v !== value)
        : [...current[key], value],
    }));
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (position) =>
        setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frameRef.current?.requestFullscreen?.();
  }

  const filtersActive = query.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <ListFilter aria-hidden="true" />
          {translate('map.filters')}
          {filtersActive && <span className="bg-primary rounded-pill size-2" aria-hidden="true" />}
        </Button>
        <Button variant="outline" onClick={locate}>
          <LocateFixed aria-hidden="true" />
          {translate('map.locate')}
        </Button>
        <p className="text-muted text-sm" aria-live="polite">
          {state === 'ready' && `${reports.length} ${translate('map.count')}`}
          {state === 'loading' && translate('map.loading')}
        </p>
      </div>

      {showFilters && (
        <div className="rounded-card border-line bg-surface-raised space-y-4 border p-4">
          <ChipGroup
            label={translate('map.type')}
            values={REPORT_TYPES}
            selected={filters.type}
            onToggle={(v) => toggle('type', v)}
            render={(v) => (
              <>
                <ReportTypeIcon type={v as (typeof REPORT_TYPES)[number]} />
                {translate(`reportType.${v as (typeof REPORT_TYPES)[number]}`)}
              </>
            )}
          />
          <ChipGroup
            label={translate('map.status')}
            values={REPORT_STATUSES.filter((s) => s !== 'REJECTED')}
            selected={filters.status}
            onToggle={(v) => toggle('status', v)}
            render={(v) => translate(`reportStatus.${v as (typeof REPORT_STATUSES)[number]}`)}
          />
          <ChipGroup
            label={translate('map.severity')}
            values={SEVERITIES}
            selected={filters.severity}
            onToggle={(v) => toggle('severity', v)}
            render={(v) => translate(`severity.${v as (typeof SEVERITIES)[number]}`)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold">
              <span className="block">{translate('map.period')}</span>
              <select
                value={filters.days}
                onChange={(event) => setFilters((f) => ({ ...f, days: event.target.value }))}
                className="min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 font-normal"
              >
                <option value="">—</option>
                <option value="7">{translate('map.days.7')}</option>
                <option value="30">{translate('map.days.30')}</option>
                <option value="365">{translate('map.days.365')}</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold">
              <span className="block">{translate('map.neighborhood')}</span>
              <select
                value={filters.neighborhoodId}
                onChange={(event) =>
                  setFilters((f) => ({ ...f, neighborhoodId: event.target.value }))
                }
                className="min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 font-normal"
              >
                <option value="">{translate('map.allNeighborhoods')}</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            variant="ghost"
            disabled={!filtersActive}
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            {translate('map.reset')}
          </Button>
        </div>
      )}

      {state === 'error' && <StateBanner kind="error" title={translate('map.error')} />}

      {/* Le contenu en mots avant la carte (DESIGN §2.4) : utile aussi sans la carte. */}
      {/* Place réservée pendant le chargement : la carte ne se décale pas à l'arrivée des données. */}
      {state === 'loading' && !result && <Skeleton className="h-[19rem] w-full sm:h-44" />}
      {(state === 'ready' || (state === 'loading' && result)) && (
        <ReportsSummary reports={reports} />
      )}

      <div
        ref={frameRef}
        className={cn(
          'rounded-card border-line bg-surface-raised relative overflow-hidden border',
          fullscreen ? 'h-dvh rounded-none' : 'h-[60vh] min-h-[24rem]',
        )}
      >
        <LazyMount>
          <ReportsMap reports={reports} userPosition={userPosition} />
        </LazyMount>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="size-touch rounded-control bg-surface-raised text-ink shadow-soft absolute top-3 right-3 z-[1000] grid place-items-center"
          aria-label={fullscreen ? translate('map.exitFullscreen') : translate('map.fullscreen')}
        >
          {fullscreen ? (
            <Minimize aria-hidden="true" className="size-5" />
          ) : (
            <Maximize aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {state === 'ready' && reports.length === 0 && (
        <EmptyState title={translate('map.empty')} body={translate('map.emptyHint')} />
      )}

      <section
        aria-labelledby="legend"
        className="rounded-card border-line bg-surface-raised border p-4"
      >
        <h2 id="legend" className="mb-3 font-semibold">
          {translate('map.legend')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {REPORT_TYPES.map((type) => (
            <li key={type} className="flex items-center gap-2 text-sm">
              <span className={`ba-marker ba-marker--${type.toLowerCase()} !size-7 [&_svg]:size-4`}>
                <ReportTypeIcon type={type} />
              </span>
              {translate(`reportType.${type}`)}
            </li>
          ))}
          <li className="flex items-center gap-2 text-sm">
            <span
              className="ba-marker ba-marker--flooding ba-marker--demo !size-7 [&_svg]:size-4"
              aria-hidden="true"
            >
              <ReportTypeIcon type="FLOODING" />
            </span>
            {translate('map.demoLegend')}
          </li>
        </ul>
        <p className="text-muted mt-3 text-sm">{translate('map.lead')}</p>
      </section>
    </div>
  );
}
