import type { NextResponse } from 'next/server';
import type { z } from 'zod';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { apiError, validationError } from './errors';
import { rateLimited, toErrorResponse } from './handle';
import type { RateLimitName } from '@/lib/security/rate-limit';

/** Corps JSON validé par un schéma Zod ; renvoie la réponse 400 à transmettre en cas d'échec. */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) return { response: apiError('VALIDATION_ERROR', 'Corps JSON attendu.') };
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { response: validationError(parsed.error) };
  return { data: parsed.data };
}

/**
 * Enveloppe d'une route qui modifie des données avec la session : contrôle d'origine (CSRF,
 * D-035), limitation de débit éventuelle, erreurs homogènes.
 */
export async function mutation(
  request: Request,
  handler: () => Promise<NextResponse>,
  options: { rateLimit?: RateLimitName } = {},
): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    if (options.rateLimit) {
      const limited = rateLimited(request, options.rateLimit);
      if (limited) return limited;
    }
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Enveloppe d'une lecture protégée (sans contrôle d'origine). */
export async function query(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}
