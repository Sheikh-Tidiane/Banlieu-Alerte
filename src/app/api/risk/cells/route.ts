import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { query } from '@/lib/api/route';
import { getRiskCells } from '@/services/risk/read';
import { horizonSchema } from '@/validators/risk';

export const dynamic = 'force-dynamic';

/** GET /api/risk/cells?horizon=24|48 – cases de la carte de risque (dernier calcul). */
export async function GET(request: Request) {
  return query(async () => {
    const horizon = horizonSchema.safeParse(new URL(request.url).searchParams.get('horizon') ?? 24);
    if (!horizon.success) return apiError('VALIDATION_ERROR', 'Horizon : 24 ou 48.');
    return NextResponse.json({ data: await getRiskCells(horizon.data) });
  });
}
