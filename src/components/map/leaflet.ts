'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ReportType } from '@/lib/reports/constants';

// Les plugins Leaflet (leaflet.markercluster) s'attachent à la variable globale L.
(globalThis as unknown as { L: typeof L }).L = L;

// Socle Leaflet partagé (D-022) : chargé uniquement par les composants carte, côté client.

/** Centre par défaut : secteur de Thiaroye (position indicative). */
export const DEFAULT_CENTER: L.LatLngTuple = [14.748, -17.38];
export const DEFAULT_ZOOM = 14;

export function createBaseMap(element: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(element, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
    attributionControl: true,
    ...options,
  });
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  addOfflineFallback(map, tiles);
  return map;
}

type OfflineMeta = { bounds: L.LatLngBoundsLiteral; attribution: string };

/**
 * Fond de plan hors ligne du pilote (D-059, EXG-34) : SVG généré à partir des données OSM,
 * mis en cache par le service worker. Il s'affiche quand le réseau manque ou que les tuiles
 * ne chargent pas ; hors de la zone pilote, un message l'explique. Aucune tuile n'est préchargée.
 */
function addOfflineFallback(map: L.Map, tiles: L.TileLayer) {
  let overlay: L.ImageOverlay | null = null;
  let bounds: L.LatLngBounds | null = null;
  let tileErrors = 0;
  const notice = L.DomUtil.create('div', 'ba-offline-notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  map.getContainer().appendChild(notice);

  const refresh = () => {
    const offline = !navigator.onLine || tileErrors >= 3;
    if (!overlay || !bounds) return;
    if (offline) {
      if (!map.hasLayer(overlay)) overlay.addTo(map).bringToBack();
      const inside = bounds.contains(map.getCenter());
      notice.hidden = false;
      notice.textContent = inside
        ? 'Hors ligne : plan simplifié de la zone pilote.'
        : 'Hors ligne : seule la zone pilote est disponible sur cet appareil.';
    } else {
      overlay.remove();
      notice.hidden = true;
    }
  };

  fetch('/offline/pilot-map.json')
    .then((response) => (response.ok ? (response.json() as Promise<OfflineMeta>) : null))
    .then((meta) => {
      if (!meta) return;
      bounds = L.latLngBounds(meta.bounds);
      overlay = L.imageOverlay('/offline/pilot-map.svg', bounds, {
        interactive: false,
        alt: 'Plan hors ligne de la zone pilote',
        attribution: meta.attribution,
      });
      refresh();
    })
    .catch(() => undefined);

  tiles.on('tileerror', () => {
    tileErrors += 1;
    refresh();
  });
  tiles.on('tileload', () => {
    if (navigator.onLine) tileErrors = 0;
  });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  map.on('moveend', refresh);
  map.on('unload', () => {
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', refresh);
  });
}

/**
 * Marqueur : couleur par type, contour en pointillés pour les données de démonstration.
 * `glyph` : SVG du pictogramme, identique aux icônes de l'interface (voir reports-map.tsx).
 */
export function reportIcon(type: ReportType, isDemo: boolean, glyph: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="ba-marker ba-marker--${type.toLowerCase()}${isDemo ? ' ba-marker--demo' : ''}">${glyph}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

/** Repère de position du formulaire (déplaçable). */
export function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: '<span class="ba-pin" aria-hidden="true"></span>',
    iconSize: [32, 42],
    iconAnchor: [16, 40],
  });
}

export { L };
