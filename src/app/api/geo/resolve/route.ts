import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validationError } from '@/lib/api/errors';
import { rateLimited, toErrorResponse } from '@/lib/api/handle';
import { resolvePosition } from '@/services/geo/neighborhoods';
import { reportFormSchema } from '@/validators/report';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ lat: reportFormSchema.shape.lat, lng: reportFormSchema.shape.lng });

/** GET /api/geo/resolve?lat=&lng= – quartiers candidats avec leur distance (CDC §10). */
export async function GET(request: Request) {
  const limited = rateLimited(request, 'resolve');
  if (limited) return limited;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const resolution = await resolvePosition(parsed.data);
    return NextResponse.json({
      data: {
        status: resolution.status,
        best: resolution.best?.neighborhoodId ?? null,
        candidates: resolution.candidates.map((candidate) => ({
          id: candidate.neighborhoodId,
          name: candidate.neighborhoodName,
          distanceMeters: candidate.distanceMeters,
        })),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
