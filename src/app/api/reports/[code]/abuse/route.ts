import { NextResponse } from 'next/server';
import { apiError, validationError } from '@/lib/api/errors';
import { rateLimited, toErrorResponse } from '@/lib/api/handle';
import { flagReport } from '@/services/reports/engagement';
import { abuseSchema } from '@/validators/report';

/** POST /api/reports/:code/abuse – signaler un abus (modération en Phase 3). */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = rateLimited(request, 'abuse');
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => null);
  if (body === null) return apiError('VALIDATION_ERROR', 'Corps JSON attendu.');
  const parsed = abuseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { code } = await params;
    return NextResponse.json({ data: await flagReport(code, parsed.data.reason) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
