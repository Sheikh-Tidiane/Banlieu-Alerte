import { NextResponse } from 'next/server';
import { query } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { listCleanupPriorities } from '@/services/cleanup/cleanup';

export const dynamic = 'force-dynamic';

/** GET /api/cleanup/priorities – caniveaux et dépôts ouverts, triés par risque × gravité. */
export async function GET() {
  return query(async () => {
    const user = await requireUser(STAFF_ROLES);
    return NextResponse.json({ data: await listCleanupPriorities(user) });
  });
}
