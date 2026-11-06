import { NextResponse } from 'next/server';
import { mutation } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { revokeInvitation } from '@/services/invitations/invitations';

type Context = { params: Promise<{ id: string }> };

/** DELETE /api/invitations/:id – révocation immédiate (journalisée). */
export async function DELETE(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const { id } = await params;
    return NextResponse.json({ data: await revokeInvitation(admin, id) });
  });
}
