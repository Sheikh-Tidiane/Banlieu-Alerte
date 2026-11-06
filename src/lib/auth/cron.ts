import { timingSafeEqual } from 'node:crypto';

/**
 * Secret du planificateur (`Authorization: Bearer <CRON_SECRET>`). Renvoie null si l'en-tête
 * est absent, false s'il est faux ou si aucun secret n'est configuré.
 */
export function hasCronSecret(request: Request): boolean | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(header.replace(/^Bearer /, ''));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
