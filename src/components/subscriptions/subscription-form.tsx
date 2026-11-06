'use client';

import { BellRing, LocateFixed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StateBanner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';
import { RISK_LEVELS, type RiskLevelCode } from '@/lib/risk/types';
import { levelLabel } from '@/lib/risk/explain';
import { RADIUS_OPTIONS } from '@/lib/reports/constants';

type Neighborhood = { id: string; name: string; isPilot: boolean };
type Position = { lat: number; lng: number; accuracy: number };

const selectClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base font-normal';
const distance = new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 1 });

export function SubscriptionForm({
  neighborhoods,
  webPushSimulated,
}: {
  neighborhoods: Neighborhood[];
  webPushSimulated: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<'neighborhoods' | 'position'>('neighborhoods');
  const [selected, setSelected] = useState<string[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState<number>(1000);
  const [minLevel, setMinLevel] = useState<RiskLevelCode>('MODERATE');
  const [locale, setLocale] = useState<'fr' | 'wo'>('fr');
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelWebPush, setChannelWebPush] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(0, 5),
    );
  }

  function locate() {
    setLocating(true);
    setError(undefined);
    if (!('geolocation' in navigator)) {
      setLocating(false);
      setError(translate('subscribe.positionError'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false);
        setPosition({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: Math.round(result.coords.accuracy),
        });
      },
      () => {
        setLocating(false);
        setError(translate('subscribe.positionError'));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (mode === 'neighborhoods' && selected.length === 0) {
      setError(translate('subscribe.chooseNeighborhood'));
      return;
    }
    if (mode === 'position' && !position) {
      setError(translate('subscribe.choosePosition'));
      return;
    }
    const common = { minLevel, locale, channelInApp, channelWebPush };
    const body =
      mode === 'neighborhoods'
        ? { mode, neighborhoodIds: selected, ...common }
        : { mode, lat: position!.lat, lng: position!.lng, radiusMeters: radius, ...common };
    setPending(true);
    const response = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setPending(false);
    if (response?.ok) {
      toast(translate('subscribe.success'));
      router.push('/mon-espace#abonnements');
      router.refresh();
      return;
    }
    const payload = (await response?.json().catch(() => null)) as {
      error?: { message: string; details?: Record<string, string[]> };
    } | null;
    const details = payload?.error?.details;
    setError(
      (details && Object.values(details)[0]?.[0]) ??
        payload?.error?.message ??
        translate('design.errorBody'),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset className="space-y-2">
        <legend className="font-semibold">{translate('subscribe.modeLabel')}</legend>
        {(['neighborhoods', 'position'] as const).map((value) => (
          <label key={value} className="min-h-touch flex items-center gap-3">
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="size-5"
            />
            {translate(
              value === 'neighborhoods' ? 'subscribe.modeNeighborhoods' : 'subscribe.modePosition',
            )}
          </label>
        ))}
      </fieldset>

      {mode === 'neighborhoods' ? (
        <fieldset className="space-y-2">
          <legend className="font-semibold">{translate('subscribe.neighborhoods')}</legend>
          <p className="text-muted text-sm">{translate('subscribe.neighborhoodsHint')}</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {neighborhoods.map((n) => (
              <label key={n.id} className="min-h-touch flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(n.id)}
                  onChange={() => toggle(n.id)}
                  className="size-5"
                />
                <span>
                  {n.name}
                  {n.isPilot && (
                    <span className="text-muted text-sm"> ({translate('subscribe.pilot')})</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="space-y-3">
          <Button type="button" variant="outline" onClick={locate} disabled={locating}>
            <LocateFixed aria-hidden="true" />
            {locating ? translate('subscribe.locating') : translate('subscribe.usePosition')}
          </Button>
          {position && (
            <p role="status" className="font-medium">
              {translate('subscribe.positionSaved')} (± {distance.format(position.accuracy)} m)
            </p>
          )}
          <p className="text-muted text-sm">{translate('subscribe.positionPrivate')}</p>
          <label className="block space-y-1 font-semibold">
            <span className="block">{translate('subscribe.radius')}</span>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className={selectClass}
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r < 1000 ? `${r} m` : `${r / 1000} km`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="block space-y-1 font-semibold">
        <span className="block">{translate('subscribe.minLevel')}</span>
        <select
          value={minLevel}
          onChange={(e) => setMinLevel(e.target.value as RiskLevelCode)}
          className={selectClass}
        >
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {levelLabel(level)}
            </option>
          ))}
        </select>
        <span className="text-muted block text-sm font-normal">
          {translate('subscribe.minLevelHint')}
        </span>
      </label>

      <label className="block space-y-1 font-semibold">
        <span className="block">{translate('subscribe.locale')}</span>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'fr' | 'wo')}
          className={selectClass}
        >
          <option value="fr">{translate('account.localeFr')}</option>
          <option value="wo">{translate('account.localeWo')}</option>
        </select>
        <span className="text-muted block text-sm font-normal">
          {translate('subscribe.localeHint')}
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="font-semibold">{translate('subscribe.channels')}</legend>
        <label className="min-h-touch flex items-center gap-3">
          <input
            type="checkbox"
            checked={channelInApp}
            onChange={(e) => setChannelInApp(e.target.checked)}
            className="size-5"
          />
          {translate('subscribe.channelInApp')}
        </label>
        <label className="min-h-touch flex items-center gap-3">
          <input
            type="checkbox"
            checked={channelWebPush}
            onChange={(e) => setChannelWebPush(e.target.checked)}
            className="size-5"
          />
          <span>
            {translate('subscribe.channelWebPush')}
            {webPushSimulated && (
              <span className="text-muted block text-sm">
                ({translate('subscribe.channelWebPushSimulated')})
              </span>
            )}
          </span>
        </label>
        <p className="text-muted text-sm">{translate('subscribe.smsLater')}</p>
      </fieldset>

      {error && <StateBanner kind="error" title={error} />}

      <Button type="submit" size="lg" disabled={pending}>
        <BellRing aria-hidden="true" />
        {translate('subscribe.submit')}
      </Button>
    </form>
  );
}
