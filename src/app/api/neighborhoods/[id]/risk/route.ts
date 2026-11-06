import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { query } from '@/lib/api/route';
import { getNeighborhoodRisk } from '@/services/risk/read';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/neighborhoods/:id/risk – indice du quartier à 24 et 48 h. */
export async function GET(_request: Request, { params }: Context) {
  return query(async () => {
    const { id } = await params;
    const data = await getNeighborhoodRisk(id);
    if (!data) return apiError('NOT_FOUND', 'Aucun indice pour ce quartier.');
    return NextResponse.json({ data });
  });
}
