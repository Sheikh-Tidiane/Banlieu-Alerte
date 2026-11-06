import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { addInternalNote } from '@/services/backoffice/processing';
import { noteSchema } from '@/validators/backoffice';

type Context = { params: Promise<{ code: string }> };

/** POST /api/reports/:code/notes – note interne, jamais publiée. */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, noteSchema);
    if ('response' in parsed) return parsed.response;
    const { code } = await params;
    return NextResponse.json(
      { data: await addInternalNote(user, code, parsed.data.body) },
      { status: 201 },
    );
  });
}
