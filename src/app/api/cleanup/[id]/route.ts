import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { updateOperation } from '@/services/cleanup/cleanup';
import { updateCleanupSchema } from '@/validators/cleanup';

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/cleanup/:id – statut, note ; « terminée » peut résoudre le signalement lié. */
export async function PATCH(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const parsed = await parseJson(request, updateCleanupSchema);
    if ('response' in parsed) return parsed.response;
    const { id } = await params;
    return NextResponse.json({ data: await updateOperation(user, id, parsed.data) });
  });
}
