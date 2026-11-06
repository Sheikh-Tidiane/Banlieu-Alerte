import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { query } from '@/lib/api/route';
import { getRiskOverview } from '@/services/risk/read';
import { horizonSchema } from '@/validators/risk';

export const dynamic = 'force-dynamic';

/** GET /api/risk/forecast?horizon=24|48 – indice par quartier, facteurs, date des données. */
export async function GET(request: Request) {
  return query(async () => {
    const horizon = horizonSchema.safeParse(new URL(request.url).searchParams.get('horizon') ?? 24);
    if (!horizon.success) return apiError('VALIDATION_ERROR', 'Horizon : 24 ou 48.');
    const overview = await getRiskOverview();
    if (!overview) return NextResponse.json({ data: null });
    return NextResponse.json({
      data: {
        horizonHours: horizon.data,
        computedAt: overview.computedAt,
        ruleVersion: overview.ruleVersion,
        weather: overview.weather,
        neighborhoods: overview.neighborhoods[horizon.data],
        isDemo: overview.isDemo,
      },
    });
  });
}
