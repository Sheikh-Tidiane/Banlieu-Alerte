import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { query } from '@/lib/api/route';
import { getCellFactors } from '@/services/risk/read';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/risk/cells/:id/factors – détail des facteurs d'une cellule (dernier calcul). */
export async function GET(_request: Request, { params }: Context) {
  return query(async () => {
    const { id } = await params;
    const data = await getCellFactors(id);
    if (!data) return apiError('NOT_FOUND', 'Cellule introuvable.');
    return NextResponse.json({ data });
  });
}
