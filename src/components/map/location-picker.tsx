'use client';

import { useEffect, useRef } from 'react';
import type { LatLng } from '@/lib/geo/distance';
import { translate } from '@/i18n';
import { createBaseMap, L, pinIcon } from './leaflet';

type Props = {
  position: LatLng | null;
  onChange: (position: LatLng) => void;
};

/**
 * Petite carte du formulaire : l'habitant touche la carte ou déplace le repère pour
 * corriger sa position. Chargée sans rendu serveur (next/dynamic).
 */
export default function LocationPicker({ position, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createBaseMap(containerRef.current, { zoom: 16 });
    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    const latLng = L.latLng(position.lat, position.lng);
    if (!markerRef.current) {
      const marker = L.marker(latLng, {
        icon: pinIcon(),
        draggable: true,
        keyboard: true,
        title: translate('reportForm.adjustHint'),
      }).addTo(map);
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        onChangeRef.current({ lat, lng });
      });
      markerRef.current = marker;
      map.setView(latLng, Math.max(map.getZoom(), 16));
    } else {
      markerRef.current.setLatLng(latLng);
      if (!map.getBounds().pad(-0.2).contains(latLng)) map.panTo(latLng);
    }
  }, [position]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={translate('reportForm.adjustHint')}
      className="rounded-card border-line h-64 w-full overflow-hidden border"
    />
  );
}
