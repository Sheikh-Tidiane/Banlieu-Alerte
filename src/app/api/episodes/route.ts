import { NextResponse } from 'next/server';
import { mutation, parseJson, query } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { createEpisode, listEpisodes } from '@/services/episodes/episodes';
import { createEpisodeSchema } from '@/validators/episodes';

export const dynamic = 'force-dynamic';

/** GET /api/episodes – épisodes de pluie (back-office). */
export async function GET() {
  return query(async () => {
    await requireUser(STAFF_ROLES);
    return NextResponse.json({ data: await listEpisodes() });
  });
}

/** POST /api/episodes – déclaration d'un épisode (agent, administrateur ; D-053). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const parsed = await parseJson(request, createEpisodeSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({ data: await createEpisode(user, parsed.data) }, { status: 201 });
  });
}
