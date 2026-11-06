import type { NextConfig } from 'next';

// Origines supplémentaires autorisées en développement (téléphone sur le réseau local,
// tunnel HTTPS). Liste de noms d'hôte séparés par des virgules, sans schéma ni port.
// Voir docs/TEST_TELEPHONE.md et docs/DECISIONS.md (D-017).
const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Politique de sécurité du contenu (D-066), en production seulement (le serveur de dev a
 * besoin d'eval et d'une connexion WebSocket). Scripts : uniquement ceux du site ;
 * « unsafe-inline » est requis par les scripts d'amorçage de Next.js tant que les pages
 * restent statiques (une CSP à nonce imposerait un rendu dynamique de toutes les pages,
 * y compris /signaler, utilisée hors ligne). Aucun « unsafe-eval ».
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Leaflet positionne cartes et marqueurs par des styles en ligne.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
  ...(isProduction
    ? [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        // HTTPS imposé pendant un an une fois le site servi en HTTPS (Caddy, D-067).
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image Docker légère : serveur autonome et seules dépendances utilisées (D-067).
  output: 'standalone',
  poweredByHeader: false,
  typedRoutes: true,
  allowedDevOrigins,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Le service worker doit toujours être relu, pour que ses mises à jour s'appliquent.
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
