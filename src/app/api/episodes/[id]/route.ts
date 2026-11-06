import { NextResponse } from 'next/server';
import { query } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { getEpisodeForLabeling } from '@/services/episodes/episodes';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/episodes/:id – cases à étiqueter dans la portée, avec les indices. */
export async function GET(_request: Request, { params }: Context) {
  return query(async () => {
    const user = await requireUser(STAFF_ROLES);
    const { id } = await params;
    return NextResponse.json({ data: await getEpisodeForLabeling(user, id) });
  });
}
