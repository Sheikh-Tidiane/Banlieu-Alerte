/* Service worker de Banlieue Alerte (D-027), écrit à la main.
 *
 * - Pages publiques : réseau d'abord, puis copie en cache, puis page « hors ligne ».
 * - Pages connectées (back-office, espace personnel, connexion, liens d'invitation) et
 *   réponses de navigation de Next.js (?_rsc) : jamais mises en cache. Elles contiennent
 *   des données personnelles ou internes, et une copie servirait une version périmée.
 * - Ressources de build (/_next/static, noms versionnés) : cache d'abord.
 * - Autres fichiers du site (logos, icônes) : cache, rafraîchi en arrière-plan.
 * - API : jamais mises en cache (données à jour, aucune donnée stockée par erreur).
 * - Les envois de signalements hors ligne passent par la file IndexedDB de l'application.
 * - À la première visite, la page envoie la liste des ressources déjà chargées
 *   (message CACHE_URLS) : elles sont mises en cache pour un usage hors ligne immédiat.
 */
const VERSION = 'v4';
const CACHE = `banlieue-alerte-${VERSION}`;
const OFFLINE_URL = '/hors-ligne';
const PRECACHE = [
  '/',
  '/signaler',
  '/urgence',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/brand/favicon.svg',
  '/brand/logo-horizontal.svg',
  // Fond de plan hors ligne du pilote (D-059, EXG-34).
  '/offline/pilot-map.svg',
  '/offline/pilot-map.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_URL)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || refresh;
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((value) => {
    try {
      const url = new URL(value, self.location.origin);
      return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          urls.map((url) =>
            cache.match(url).then((hit) => hit || cache.add(url).catch(() => undefined)),
          ),
        ),
      ),
  );
});

/** Pages publiques qui peuvent être consultées hors ligne. */
function isPublicPage(pathname) {
  return (
    [
      '/',
      '/signaler',
      '/carte',
      '/carte-risque',
      '/urgence',
      '/alertes',
      '/apprendre',
      '/statistiques',
      '/qualite-indice',
      OFFLINE_URL,
    ].includes(pathname) || pathname.startsWith('/signalements/')
  );
}

/** Pages privées hors ligne : page « hors ligne », sans copie en cache. */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  // Données de navigation de Next.js (rafraîchissement, liens) : toujours le réseau.
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') return;

  if (request.mode === 'navigate') {
    event.respondWith(isPublicPage(url.pathname) ? networkFirst(request) : networkOnly(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
