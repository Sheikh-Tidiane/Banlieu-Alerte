import { NextResponse } from 'next/server';
import { mutation } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { deleteSubscription } from '@/services/subscriptions/subscriptions';

type Context = { params: Promise<{ id: string }> };

/** DELETE /api/subscriptions/:id – suppression par son titulaire. */
export async function DELETE(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser();
    const { id } = await params;
    return NextResponse.json({ data: await deleteSubscription(user, id) });
  });
}
