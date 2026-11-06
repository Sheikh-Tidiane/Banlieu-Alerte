import { NextResponse } from 'next/server';
import { mutation } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { validateEpisode } from '@/services/episodes/episodes';

type Context = { params: Promise<{ id: string }> };

/** POST /api/episodes/:id/validate – clôture de l'étiquetage (agent, administrateur). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const { id } = await params;
    return NextResponse.json({ data: await validateEpisode(user, id) });
  });
}
