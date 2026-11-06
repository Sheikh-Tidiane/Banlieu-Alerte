import { NextResponse } from 'next/server';
import { apiError, validationError } from '@/lib/api/errors';
import { rateLimited, toErrorResponse } from '@/lib/api/handle';
import { isSameOrigin } from '@/lib/auth/csrf';
import { getCurrentUser } from '@/lib/auth/session';
import { PHOTO_MAX_BYTES } from '@/lib/photos/process';
import { createReport } from '@/services/reports/create';
import { listPublicReports } from '@/services/reports/read';
import { createReportSchema, listReportsSchema } from '@/validators/report';

export const dynamic = 'force-dynamic';

/** GET /api/reports?bbox=&type=&status=&severity=&neighborhoodId=&days= */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listReportsSchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const reports = await listPublicReports(parsed.data);
    return NextResponse.json({ data: reports, count: reports.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/reports (multipart/form-data) : signalement sans compte (EXG-02). */
export async function POST(request: Request) {
  const limited = rateLimited(request, 'createReport');
  if (limited) return limited;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('VALIDATION_ERROR', 'Formulaire illisible.');
  }

  const fields = Object.fromEntries(
    [...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const parsed = createReportSchema.safeParse(fields);
  if (!parsed.success) return validationError(parsed.error);

  const file = form.get('photo');
  let photo: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > PHOTO_MAX_BYTES) {
      const message = 'Photo trop lourde (5 Mo maximum).';
      return apiError('VALIDATION_ERROR', message, { photo: [message] });
    }
    photo = Buffer.from(await file.arrayBuffer());
  }

  try {
    // Habitant connecté : le signalement est rattaché à son compte, si la requête vient bien
    // de l'application (CSRF, D-035). Sinon, il est enregistré sans compte.
    const user = isSameOrigin(request) ? await getCurrentUser() : null;
    const result = await createReport(parsed.data, photo, user?.id ?? null);
    return NextResponse.json({ data: result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
