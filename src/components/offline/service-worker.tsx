'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker (public/sw.js) en production uniquement : en
 * développement, il gênerait le rechargement à chaud.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Ressources chargées avant l'activation du service worker : à mettre en cache.
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(`${location.origin}/_next/static/`));
        registration.active?.postMessage({ type: 'CACHE_URLS', urls });
      })
      .catch(() => {
        // Sans service worker, l'application fonctionne en ligne ; la file locale reste active.
      });
  }, []);
  return null;
}
