import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/handle';
import { listPublicNeighborhoods } from '@/services/geo/neighborhoods';

export const dynamic = 'force-dynamic';

/** GET /api/neighborhoods – quartiers, pour les filtres de la carte. */
export async function GET() {
  try {
    return NextResponse.json({ data: await listPublicNeighborhoods() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
