import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { approveAlert } from '@/services/alerts/manage';
import { approveAlertSchema } from '@/validators/alerts';

type Context = { params: Promise<{ id: string }> };

/** POST /api/alerts/:id/approve – approbation humaine journalisée, puis envoi (EXG-29). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, approveAlertSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await approveAlert(user, id, parsed.data) });
  });
}
