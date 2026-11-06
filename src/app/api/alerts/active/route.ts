import { NextResponse } from 'next/server';
import { query } from '@/lib/api/route';
import { listActiveAlerts } from '@/services/alerts/read';

export const dynamic = 'force-dynamic';

/** GET /api/alerts/active – alertes en cours (public, sans créateur ni livraisons). */
export async function GET() {
  return query(async () => NextResponse.json({ data: await listActiveAlerts() }));
}
