import { NextResponse } from 'next/server';
import { query } from '@/lib/api/route';
import { getIndexQuality } from '@/services/risk/quality';

export const dynamic = 'force-dynamic';

/** GET /api/model/performance – qualité de l'indice ; état vide sous le seuil (EXG-12). */
export async function GET() {
  return query(async () => NextResponse.json({ data: await getIndexQuality() }));
}
