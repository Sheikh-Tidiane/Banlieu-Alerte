'use client';

import { LocateFixed, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { loadLocationPicker } from '@/components/map/load-location-picker';
import { Skeleton } from '@/components/ui/states';
import type { LatLng } from '@/lib/geo/distance';
import { translate } from '@/i18n';
import { cn } from '@/lib/utils/cn';

const LocationPicker = dynamic(loadLocationPicker, {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

type Candidate = { id: string; name: string; distanceMeters: number };
type Resolved = {
  status: 'automatic' | 'ambiguous' | 'unidentified';
  best: string | null;
  candidates: Candidate[];
};
/** Résultat de la recherche du quartier, associé à la position qui l'a produit. */
type Resolution = { key: string } & (
  { state: 'offline' | 'error' } | ({ state: 'resolved' } & Resolved)
);

type Props = {
  position: LatLng | null;
  onPositionChange: (position: LatLng) => void;
  neighborhoodId: string | undefined;
  onNeighborhoodChange: (id: string | undefined) => void;
  error?: string;
};

type GeoState = 'locating' | 'located' | 'denied';

const positionKey = (position: LatLng) => `${position.lat.toFixed(6)},${position.lng.toFixed(6)}`;

/** Étape 2 : position GPS automatique, ajustable sur la carte, et quartier proposé. */
export function LocationStep({
  position,
  onPositionChange,
  neighborhoodId,
  onNeighborhoodChange,
  error,
}: Props) {
  const [geo, setGeo] = useState<GeoState>(position ? 'located' : 'locating');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const currentKey = position ? positionKey(position) : null;
  // Recherche en cours tant que le résultat ne correspond pas à la position affichée.
  const shown = resolution && resolution.key === currentKey ? resolution : null;

  const requestPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      // Même chemin asynchrone qu'un refus de permission.
      window.setTimeout(() => setGeo('denied'), 0);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setAccuracy(Math.round(result.coords.accuracy));
        setGeo('located');
        onPositionChange({ lat: result.coords.latitude, lng: result.coords.longitude });
      },
      () => setGeo('denied'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, [onPositionChange]);

  function locate() {
    setGeo('locating');
    requestPosition();
  }

  useEffect(() => {
    // La localisation n'est lancée automatiquement qu'à l'arrivée sur l'étape.
    if (!position) requestPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quartiers candidats, recalculés quand la position change (avec un court délai).
  useEffect(() => {
    if (!position) return;
    const key = positionKey(position);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!navigator.onLine) {
        setResolution({ key, state: 'offline' });
        return;
      }
      try {
        const response = await fetch(`/api/geo/resolve?lat=${position.lat}&lng=${position.lng}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { data?: Resolved };
        if (!response.ok || !body.data) throw new Error();
        setResolution({ key, state: 'resolved', ...body.data });
        onNeighborhoodChange(body.data.best ?? undefined);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResolution({ key, state: cause instanceof TypeError ? 'offline' : 'error' });
        }
      }
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [position, onNeighborhoodChange]);

  return (
    <div className="space-y-4">
      <div aria-live="polite" className="text-sm">
        {geo === 'locating' && <p className="text-muted">{translate('reportForm.locating')}</p>}
        {geo === 'located' && (
          <p className="text-safe flex items-center gap-1 font-medium">
            <MapPin aria-hidden="true" className="size-4" />
            {translate('reportForm.located')}
            {accuracy !== null && ` (${translate('reportForm.accuracy')} ${accuracy} m)`}
          </p>
        )}
        {geo === 'denied' && (
          <p className="font-medium">{translate('reportForm.locationDenied')}</p>
        )}
      </div>

      <LocationPicker position={position} onChange={onPositionChange} />
      <p className="text-muted text-sm">{translate('reportForm.adjustHint')}</p>

      {geo !== 'locating' && (
        <Button variant="outline" onClick={locate}>
          <LocateFixed aria-hidden="true" />
          {geo === 'denied'
            ? translate('reportForm.locationRetry')
            : translate('reportForm.useMyPosition')}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      )}

      {position && (
        <div
          className="rounded-card border-line bg-surface-raised space-y-3 border p-4"
          aria-live="polite"
        >
          <p className="text-muted text-sm font-semibold">{translate('reportForm.neighborhood')}</p>
          {!shown && <Skeleton className="h-6 w-40" />}
          {shown?.state === 'offline' && <p>{translate('reportForm.neighborhoodOffline')}</p>}
          {shown?.state === 'error' && <p>{translate('reportForm.neighborhoodUnidentified')}</p>}
          {shown?.state === 'resolved' && shown.status === 'unidentified' && (
            <p>{translate('reportForm.neighborhoodUnidentified')}</p>
          )}
          {shown?.state === 'resolved' && shown.status !== 'unidentified' && (
            <>
              {shown.status === 'ambiguous' && <p>{translate('reportForm.neighborhoodChoose')}</p>}
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={translate('reportForm.neighborhood')}
              >
                {shown.candidates.map((candidate) => {
                  const selected = (neighborhoodId ?? shown.best) === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onNeighborhoodChange(candidate.id)}
                      className={cn(
                        'min-h-touch rounded-pill border-2 px-4 font-medium',
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-line bg-surface',
                      )}
                    >
                      {candidate.name}
                    </button>
                  );
                })}
              </div>
              <Badge tone="neutral">{translate('reportForm.neighborhoodApprox')}</Badge>
            </>
          )}
        </div>
      )}
    </div>
  );
}
