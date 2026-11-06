import { NextResponse } from 'next/server';
import { mutation } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { dismissAbuse } from '@/services/backoffice/moderation';

type Context = { params: Promise<{ id: string }> };

/** POST /api/abuse/:id/dismiss – classer un signalement d'abus sans suite. */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const { id } = await params;
    return NextResponse.json({ data: await dismissAbuse(user, id) });
  });
}
