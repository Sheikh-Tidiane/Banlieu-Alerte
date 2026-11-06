import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { changeStatus } from '@/services/backoffice/processing';
import { statusChangeSchema } from '@/validators/backoffice';

type Context = { params: Promise<{ code: string }> };

/** PATCH /api/reports/:code/status – changement de statut (EXG-07). */
export async function PATCH(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, statusChangeSchema);
    if ('response' in parsed) return parsed.response;
    const { code } = await params;
    return NextResponse.json({
      data: await changeStatus(user, code, parsed.data.status, parsed.data.reason),
    });
  });
}
