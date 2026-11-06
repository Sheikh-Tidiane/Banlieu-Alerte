import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiError, validationError } from '@/lib/api/errors';

describe("format d'erreur des API", () => {
  it('associe le bon code HTTP', async () => {
    const response = apiError('FORBIDDEN', 'Accès refusé.');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: 'Accès refusé.' },
    });
  });

  it('détaille les erreurs Zod par champ', async () => {
    const parsed = z.object({ lat: z.number().min(-90) }).safeParse({ lat: -100 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const response = validationError(parsed.error);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(body.error.details)).toEqual(['lat']);
  });
});
