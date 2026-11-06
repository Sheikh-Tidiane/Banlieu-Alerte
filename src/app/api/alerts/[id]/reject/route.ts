import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { rejectAlert } from '@/services/alerts/manage';
import { reasonSchema } from '@/validators/alerts';

type Context = { params: Promise<{ id: string }> };

/** POST /api/alerts/:id/reject – rejet avec motif. */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, reasonSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await rejectAlert(user, id, parsed.data.reason) });
  });
}
