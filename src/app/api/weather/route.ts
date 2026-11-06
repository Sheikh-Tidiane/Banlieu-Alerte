import { NextResponse } from 'next/server';
import { query } from '@/lib/api/route';
import { getRiskOverview } from '@/services/risk/read';

export const dynamic = 'force-dynamic';

/**
 * GET /api/weather – pluie prévue sur 48 h (tranches de 6 h) pour la zone pilote, avec la
 * date et la source du relevé. Un seul point de prévision pour le pilote (D-045).
 */
export async function GET() {
  return query(async () => {
    const overview = await getRiskOverview();
    if (!overview) return NextResponse.json({ data: null });
    return NextResponse.json({ data: { weather: overview.weather, outlook: overview.outlook } });
  });
}
