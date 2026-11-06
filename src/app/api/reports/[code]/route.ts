import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { toErrorResponse } from '@/lib/api/handle';
import { getPublicReport } from '@/services/reports/read';

export const dynamic = 'force-dynamic';

/** GET /api/reports/:code – détail public, par numéro de suivi. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const report = await getPublicReport(code);
    if (!report) return apiError('NOT_FOUND', 'Signalement introuvable.');
    return NextResponse.json({ data: report });
  } catch (error) {
    return toErrorResponse(error);
  }
}
