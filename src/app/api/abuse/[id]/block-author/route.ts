import { NextResponse } from 'next/server';
import { mutation } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { blockCommentAuthor } from '@/services/backoffice/moderation';

type Context = { params: Promise<{ id: string }> };

/** POST /api/abuse/:id/block-author – bloquer l'auteur d'un commentaire signalé (administrateur). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(['ADMIN']);
    const { id } = await params;
    return NextResponse.json({ data: await blockCommentAuthor(user, id) });
  });
}
