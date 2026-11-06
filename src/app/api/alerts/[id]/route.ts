import { NextResponse } from 'next/server';
import { mutation, parseJson, query } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { updateAlert } from '@/services/alerts/manage';
import { getStaffAlert } from '@/services/alerts/read';
import { alertChangesSchema } from '@/validators/alerts';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/alerts/:id – fiche d'une alerte (back-office, dans la portée). */
export async function GET(_request: Request, { params }: Context) {
  return query(async () => {
    const user = await requireUser(STAFF_ROLES);
    const { id } = await params;
    return NextResponse.json({ data: await getStaffAlert(user, id) });
  });
}

/** PATCH /api/alerts/:id – modification d'un brouillon en attente. */
export async function PATCH(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, alertChangesSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await updateAlert(user, id, parsed.data) });
  });
}
