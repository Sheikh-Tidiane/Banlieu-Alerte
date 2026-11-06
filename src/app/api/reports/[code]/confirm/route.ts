import { NextResponse } from 'next/server';
import { apiError, validationError } from '@/lib/api/errors';
import { rateLimited, toErrorResponse } from '@/lib/api/handle';
import { confirmReport } from '@/services/reports/engagement';
import { deviceSchema } from '@/validators/report';

/** POST /api/reports/:code/confirm – « Je vois aussi ce problème ». */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = rateLimited(request, 'vote');
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => null);
  if (body === null) return apiError('VALIDATION_ERROR', 'Corps JSON attendu.');
  const parsed = deviceSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { code } = await params;
    return NextResponse.json({ data: await confirmReport(code, parsed.data.deviceId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
