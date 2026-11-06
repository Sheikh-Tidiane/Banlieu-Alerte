'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { translate } from '@/i18n';

type Landmark = {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  source: string | null;
};
type Neighborhood = {
  id: string;
  name: string;
  isPilot: boolean;
  boundaryStatus: 'APPROXIMATE' | 'VALIDATED';
  isDemo: boolean;
  delegate: { id: string; name: string } | null;
  landmarks: Landmark[];
  aliases: { id: string; alias: string; locale: string }[];
  _count: { reports: number };
};
type Commune = {
  id: string;
  name: string;
  department: string;
  isDemo: boolean;
  neighborhoods: Neighborhood[];
};

const KINDS = ['MARKET', 'SCHOOL', 'MOSQUE', 'STATION', 'HEALTH', 'OTHER'] as const;
const selectClass =
  'min-h-touch rounded-control border-line bg-surface-raised w-full border-2 px-3 text-base';
const labelClass = 'block space-y-1 text-sm font-semibold';

function useZoneAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  async function run(body: unknown, success: string) {
    setPending(true);
    const response = await fetch('/api/admin/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setPending(false);
    const payload = (await response?.json().catch(() => null)) as {
      error?: { message: string; details?: Record<string, string[]> };
    } | null;
    if (response?.ok) {
      toast(success);
      router.refresh();
      return true;
    }
    const detail = payload?.error?.details && Object.values(payload.error.details)[0]?.[0];
    toast(detail ?? payload?.error?.message ?? translate('design.errorBody'), 'error');
    return false;
  }
  return { pending, run };
}

function NeighborhoodCard({
  neighborhood,
  delegates,
}: {
  neighborhood: Neighborhood;
  delegates: { id: string; name: string }[];
}) {
  const { pending, run } = useZoneAction();
  const [isPilot, setIsPilot] = useState(neighborhood.isPilot);
  const [boundaryStatus, setBoundaryStatus] = useState(neighborhood.boundaryStatus);
  const [delegateId, setDelegateId] = useState(neighborhood.delegate?.id ?? '');
  const [landmark, setLandmark] = useState({
    name: '',
    kind: 'MARKET',
    lat: '',
    lng: '',
    radiusMeters: '400',
    source: '',
  });
  const [alias, setAlias] = useState('');

  return (
    <li className="rounded-card border-line bg-surface-raised space-y-4 border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-heading text-lg font-semibold">{neighborhood.name}</h4>
        {neighborhood.isPilot && (
          <Badge tone="primary">{translate('backoffice.zones.pilot')}</Badge>
        )}
        {neighborhood.isDemo && <DemoBadge />}
        <span className="text-muted text-sm">
          {neighborhood._count.reports} {translate('backoffice.reports.count')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="min-h-touch flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isPilot}
            onChange={(e) => setIsPilot(e.target.checked)}
            className="size-5"
          />
          {translate('backoffice.zones.pilot')}
        </label>
        <label className={labelClass}>
          <span className="block">{translate('backoffice.zones.boundary')}</span>
          <select
            value={boundaryStatus}
            onChange={(e) => setBoundaryStatus(e.target.value as typeof boundaryStatus)}
            className={selectClass}
          >
            <option value="APPROXIMATE">{translate('backoffice.zones.boundaryApproximate')}</option>
            <option value="VALIDATED">{translate('backoffice.zones.boundaryValidated')}</option>
          </select>
        </label>
        <label className={labelClass}>
          <span className="block">{translate('backoffice.zones.delegate')}</span>
          <select
            value={delegateId}
            onChange={(e) => setDelegateId(e.target.value)}
            className={selectClass}
          >
            <option value="">{translate('backoffice.zones.noDelegate')}</option>
            {delegates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(
            {
              action: 'updateNeighborhood',
              id: neighborhood.id,
              data: { isPilot, boundaryStatus, delegateId: delegateId || null },
            },
            translate('backoffice.zones.saved'),
          )
        }
      >
        {translate('backoffice.zones.save')}
      </Button>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{translate('backoffice.zones.landmarks')}</p>
        <ul className="space-y-1 text-sm">
          {neighborhood.landmarks.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2">
              <span>
                {l.name} · {translate(`backoffice.zones.kinds.${l.kind as (typeof KINDS)[number]}`)}{' '}
                · {l.lat.toFixed(5)}, {l.lng.toFixed(5)} · {l.radiusMeters} m
                {l.source ? ` · ${l.source}` : ''}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    { action: 'delete', kind: 'landmark', id: l.id },
                    translate('backoffice.zones.deleted'),
                  )
                }
                className="size-touch text-muted hover:bg-line/60 rounded-control grid place-items-center"
                aria-label={`${translate('backoffice.zones.delete')} ${l.name}`}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-6"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await run(
              {
                action: 'addLandmark',
                neighborhoodId: neighborhood.id,
                data: {
                  name: landmark.name,
                  kind: landmark.kind,
                  lat: Number(landmark.lat),
                  lng: Number(landmark.lng),
                  radiusMeters: Number(landmark.radiusMeters),
                  source: landmark.source,
                },
              },
              translate('backoffice.zones.saved'),
            );
            if (ok)
              setLandmark({
                name: '',
                kind: 'MARKET',
                lat: '',
                lng: '',
                radiusMeters: '400',
                source: '',
              });
          }}
        >
          <Input
            aria-label={translate('backoffice.zones.name')}
            placeholder={translate('backoffice.zones.name')}
            value={landmark.name}
            onChange={(e) => setLandmark({ ...landmark, name: e.target.value })}
            className="sm:col-span-2"
          />
          <select
            aria-label={translate('backoffice.zones.landmarkKind')}
            value={landmark.kind}
            onChange={(e) => setLandmark({ ...landmark, kind: e.target.value })}
            className={selectClass}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {translate(`backoffice.zones.kinds.${k}`)}
              </option>
            ))}
          </select>
          <Input
            aria-label={translate('backoffice.zones.lat')}
            placeholder={translate('backoffice.zones.lat')}
            inputMode="decimal"
            value={landmark.lat}
            onChange={(e) => setLandmark({ ...landmark, lat: e.target.value })}
          />
          <Input
            aria-label={translate('backoffice.zones.lng')}
            placeholder={translate('backoffice.zones.lng')}
            inputMode="decimal"
            value={landmark.lng}
            onChange={(e) => setLandmark({ ...landmark, lng: e.target.value })}
          />
          <Input
            aria-label={translate('backoffice.zones.radius')}
            placeholder={translate('backoffice.zones.radius')}
            inputMode="numeric"
            value={landmark.radiusMeters}
            onChange={(e) => setLandmark({ ...landmark, radiusMeters: e.target.value })}
          />
          <Input
            aria-label={translate('backoffice.zones.source')}
            placeholder={translate('backoffice.zones.source')}
            value={landmark.source}
            onChange={(e) => setLandmark({ ...landmark, source: e.target.value })}
            className="sm:col-span-4"
          />
          <Button type="submit" variant="outline" disabled={pending} className="sm:col-span-2">
            {translate('backoffice.zones.addLandmark')}
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{translate('backoffice.zones.aliases')}</p>
        <ul className="flex flex-wrap gap-2">
          {neighborhood.aliases.map((a) => (
            <li
              key={a.id}
              className="rounded-pill border-line flex items-center gap-1 border pl-3 text-sm"
            >
              {a.alias} ({a.locale})
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    { action: 'delete', kind: 'alias', id: a.id },
                    translate('backoffice.zones.deleted'),
                  )
                }
                className="size-touch text-muted rounded-pill grid place-items-center"
                aria-label={`${translate('backoffice.zones.delete')} ${a.alias}`}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await run(
                {
                  action: 'addAlias',
                  neighborhoodId: neighborhood.id,
                  data: { alias, locale: 'fr' },
                },
                translate('backoffice.zones.saved'),
              )
            ) {
              setAlias('');
            }
          }}
        >
          <Input
            aria-label={translate('backoffice.zones.alias')}
            placeholder={translate('backoffice.zones.alias')}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline" disabled={pending || alias.trim().length < 2}>
            {translate('backoffice.zones.addAlias')}
          </Button>
        </form>
      </div>
    </li>
  );
}

function AddForm({
  placeholder,
  label,
  onSubmit,
}: {
  placeholder: string;
  label: string;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onSubmit(name)) setName('');
      }}
    >
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="max-w-xs"
      />
      <Button type="submit" variant="outline" disabled={name.trim().length < 2}>
        {label}
      </Button>
    </form>
  );
}

export function ZoneManager({
  communes,
  delegates,
}: {
  communes: Commune[];
  delegates: { id: string; name: string }[];
}) {
  const { run } = useZoneAction();
  return (
    <div className="space-y-8">
      {communes.map((commune) => (
        <section key={commune.id} aria-labelledby={`commune-${commune.id}`} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`commune-${commune.id}`} className="text-xl font-semibold">
              {commune.name}
            </h3>
            <span className="text-muted text-sm">{commune.department}</span>
            {commune.isDemo && <DemoBadge />}
          </div>
          <ul className="space-y-3">
            {commune.neighborhoods.map((n) => (
              <NeighborhoodCard key={n.id} neighborhood={n} delegates={delegates} />
            ))}
          </ul>
          <AddForm
            placeholder={translate('backoffice.zones.name')}
            label={translate('backoffice.zones.addNeighborhood')}
            onSubmit={(name) =>
              run(
                { action: 'createNeighborhood', data: { name, communeId: commune.id } },
                translate('backoffice.zones.saved'),
              )
            }
          />
        </section>
      ))}
      <section className="space-y-2">
        <h3 className="text-xl font-semibold">{translate('backoffice.zones.addCommune')}</h3>
        <AddForm
          placeholder={translate('backoffice.zones.name')}
          label={translate('backoffice.zones.addCommune')}
          onSubmit={(name) =>
            run(
              { action: 'createCommune', data: { name, department: 'Pikine' } },
              translate('backoffice.zones.saved'),
            )
          }
        />
      </section>
    </div>
  );
}
