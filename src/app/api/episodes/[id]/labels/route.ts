import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { setLabels } from '@/services/episodes/episodes';
import { labelsSchema } from '@/validators/episodes';

type Context = { params: Promise<{ id: string }> };

/** POST /api/episodes/:id/labels – étiquettes « inondé / non inondé / inconnu », avec historique. */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, labelsSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await setLabels(user, id, parsed.data.labels) });
  });
}
