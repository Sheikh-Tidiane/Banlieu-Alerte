import { NextResponse } from 'next/server';
import { query } from '@/lib/api/route';
import { getPublicStatistics } from '@/services/stats/public';

export const dynamic = 'force-dynamic';

/** GET /api/stats/public – statistiques par quartier et par mois (données réelles uniquement). */
export async function GET() {
  return query(async () => NextResponse.json({ data: await getPublicStatistics() }));
}
