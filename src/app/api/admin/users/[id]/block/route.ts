import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { setUserBlocked } from '@/services/invitations/invitations';
import { blockSchema } from '@/validators/auth';

type Context = { params: Promise<{ id: string }> };

/** POST /api/admin/users/:id/block – bloquer (sessions fermées) ou débloquer un compte. */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const parsed = await parseJson(request, blockSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await setUserBlocked(admin, id, parsed.data.blocked) });
  });
}
