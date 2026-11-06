'use client';

// Ordre important : ./leaflet expose L globalement avant le chargement du plugin.
import { createBaseMap, L, reportIcon } from './leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useEffect, useRef } from 'react';
import { ReportTypeIcon } from '@/components/reports/report-type-icon';
import type { PublicReportSummary } from '@/services/reports/public';
import { REPORT_TYPES } from '@/lib/reports/constants';
import { translate } from '@/i18n';

type Props = {
  reports: PublicReportSummary[];
  /** Position de l'utilisateur après « Me localiser ». */
  userPosition: { lat: number; lng: number } | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Fiche rapide d'un marqueur (contenu texte échappé, aucun HTML venant des habitants). */
function popupHtml(report: PublicReportSummary) {
  const type = translate(`reportType.${report.type}`);
  const status = translate(`reportStatus.${report.status}`);
  const neighborhood = report.neighborhood?.name ?? translate('map.unidentified');
  const date = new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' }).format(
    new Date(report.createdAt),
  );
  const demo = report.isDemo ? `<p class="ba-popup-demo">${translate('common.demoData')}</p>` : '';
  return `<div class="ba-popup">
    <p class="ba-popup-title">${escapeHtml(type)}</p>
    <p>${escapeHtml(status)} · ${escapeHtml(neighborhood)}</p>
    <p>${escapeHtml(date)} · ${report.confirmationCount} ${translate('map.confirmations')}</p>
    ${demo}
    <a class="ba-popup-link" href="/signalements/${encodeURIComponent(report.trackingCode)}">${translate('map.seeDetail')}</a>
  </div>`;
}

/** Carte publique des signalements, avec regroupement des marqueurs (D-022). */
export default function ReportsMap({ reports, userPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const fittedRef = useRef(false);
  // Pictogrammes rendus par React (identiques à l'interface), réutilisés par les marqueurs.
  const glyphsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createBaseMap(containerRef.current);
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
    map.addLayer(cluster);
    mapRef.current = map;
    clusterRef.current = cluster;
    // La carte change de taille en plein écran ou quand les filtres s'ouvrent.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    const markers = reports.map((report) =>
      L.marker([report.lat, report.lng], {
        icon: reportIcon(
          report.type,
          report.isDemo,
          glyphsRef.current?.querySelector(`[data-type="${report.type}"]`)?.innerHTML ?? '',
        ),
        title: translate(`reportType.${report.type}`),
        alt: translate(`reportType.${report.type}`),
        keyboard: true,
      }).bindPopup(popupHtml(report)),
    );
    cluster.addLayers(markers);
    if (!fittedRef.current && markers.length > 0) {
      map.fitBounds(cluster.getBounds(), { padding: [32, 32], maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [reports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) return;
    userMarkerRef.current?.remove();
    // Couleurs lues dans les tokens (globals.css) : Leaflet dessine en SVG, sans classes Tailwind.
    const styles = getComputedStyle(document.documentElement);
    userMarkerRef.current = L.circleMarker([userPosition.lat, userPosition.lng], {
      radius: 9,
      color: styles.getPropertyValue('--neutral-surface').trim(),
      weight: 3,
      fillColor: styles.getPropertyValue('--brand-water').trim(),
      fillOpacity: 1,
    }).addTo(map);
    map.setView([userPosition.lat, userPosition.lng], 16);
  }, [userPosition]);

  return (
    <>
      <div
        ref={containerRef}
        role="region"
        aria-label={translate('map.title')}
        className="h-full min-h-[24rem] w-full"
      />
      <div ref={glyphsRef} hidden>
        {REPORT_TYPES.map((type) => (
          <span key={type} data-type={type}>
            <ReportTypeIcon type={type} />
          </span>
        ))}
      </div>
    </>
  );
}
