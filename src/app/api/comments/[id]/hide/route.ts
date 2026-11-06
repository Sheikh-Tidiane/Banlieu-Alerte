import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { setCommentHidden } from '@/services/reports/comments';
import { hideSchema } from '@/validators/backoffice';

type Context = { params: Promise<{ id: string }> };

/** POST /api/comments/:id/hide – masquer ou rétablir un commentaire public (modération). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, hideSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await setCommentHidden(user, id, parsed.data.hidden) });
  });
}
