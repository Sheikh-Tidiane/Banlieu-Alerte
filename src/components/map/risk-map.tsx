'use client';

import { createBaseMap, L } from './leaflet';
import { useEffect, useRef } from 'react';
import { hatchId, hatchPattern, RISK_COLOR } from '@/components/risk/hatch';
import { translate } from '@/i18n';
import { levelLabel } from '@/lib/risk/explain';
import { RISK_LEVELS } from '@/lib/risk/types';
import type { PublicRiskCell } from '@/services/risk/read';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const METERS_PER_DEGREE_LAT = 111_320;

function cellBounds(cell: PublicRiskCell): L.LatLngBoundsExpression {
  const dLat = cell.sizeMeters / 2 / METERS_PER_DEGREE_LAT;
  const dLng = dLat / Math.cos((cell.lat * Math.PI) / 180);
  return [
    [cell.lat - dLat, cell.lng - dLng],
    [cell.lat + dLat, cell.lng + dLng],
  ];
}

function popupHtml(cell: PublicRiskCell, dataDate: string) {
  const factors = cell.factors.length
    ? `<ul>${cell.factors.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
    : `<p>${translate('alertsPage.noFactor')}</p>`;
  const score =
    cell.score === null
      ? ''
      : `<p>${translate('alertsPage.score')} ${cell.score} ${translate('alertsPage.outOf')} (${translate('alertsPage.indicativeScore')})</p>`;
  return `<div class="ba-popup">
    <p class="ba-popup-title">${escapeHtml(levelLabel(cell.level))}</p>
    ${score}
    <p>${translate('alertsPage.mainFactors')} :</p>
    ${factors}
    ${cell.cappedWithoutRain ? `<p>${translate('alertsPage.cappedWithoutRain')}</p>` : ''}
    <p class="ba-popup-meta">${escapeHtml(dataDate)}</p>
    ${cell.isDemo ? `<p class="ba-popup-demo">${translate('common.demoData')}</p>` : ''}
  </div>`;
}

/** Carte de risque : une case de 250 m par rectangle, couleur et motif selon le niveau (D-060). */
export default function RiskMap({
  cells,
  dataDate,
}: {
  cells: PublicRiskCell[];
  dataDate: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createBaseMap(containerRef.current);
    const renderer = L.svg({ padding: 0.5 });
    const layer = L.layerGroup().addTo(map);
    renderer.addTo(map);
    // Motifs de hachure injectés dans le SVG de Leaflet (contenu statique, sans donnée externe).
    const svg = map.getPanes().overlayPane.querySelector('svg');
    if (svg) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = RISK_LEVELS.map((level) => hatchPattern(level)).join('');
      svg.prepend(defs);
    }
    mapRef.current = map;
    layerRef.current = layer;
    (map as L.Map & { baRenderer?: L.Renderer }).baRenderer = renderer;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current as (L.Map & { baRenderer?: L.Renderer }) | null;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const cell of cells) {
      const rect = L.rectangle(cellBounds(cell), {
        renderer: map.baRenderer,
        weight: cell.level ? 0.5 : 1,
        dashArray: cell.level ? undefined : '3 3',
        color: cell.level ? RISK_COLOR[cell.level] : 'var(--neutral-muted)',
        fillColor: cell.level ? `url(#${hatchId(cell.level)})` : 'transparent',
        fillOpacity: 1,
      });
      rect.bindPopup(popupHtml(cell, dataDate));
      rect.addTo(layer);
    }
    if (!fittedRef.current && cells.length > 0) {
      const group = L.featureGroup(layer.getLayers() as L.Layer[]);
      map.fitBounds(group.getBounds(), { padding: [16, 16] });
      fittedRef.current = true;
    }
  }, [cells, dataDate]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={translate('riskMap.title')}
      className="h-full min-h-[24rem] w-full"
    />
  );
}
