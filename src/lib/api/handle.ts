import type { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { sanitizeErrorMessage } from '@/lib/supervision/sanitize';
import { checkRateLimit, type RateLimitName } from '@/lib/security/rate-limit';
import { clientIp, fingerprint } from '@/lib/security/hash';
import { ServiceError } from '@/services/errors';
import { apiError } from './errors';

/** Traduit les erreurs métier en réponses homogènes ; journalise le reste sans donnée personnelle. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ServiceError) return apiError(error.code, error.message, error.details);
  const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'inconnue');
  console.error('[api] erreur inattendue :', message);
  // Journal d'erreurs (EXG-37), sans donnée personnelle ; un échec d'écriture est ignoré.
  void getPrisma()
    .errorLog.create({
      data: {
        source: 'api',
        message,
        context: { type: error instanceof Error ? error.name : typeof error },
      },
    })
    .catch(() => undefined);
  return apiError('INTERNAL_ERROR', 'Une erreur est survenue. Merci de réessayer.');
}

/** Limitation de débit par IP hachée ; renvoie une réponse 429 si la limite est atteinte. */
export function rateLimited(request: Request, name: RateLimitName): NextResponse | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(
    name,
    fingerprint(clientIp(request.headers), 'ip'),
  );
  if (allowed) return null;
  const response = apiError('RATE_LIMITED', 'Trop de demandes. Merci de patienter un peu.');
  response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}
