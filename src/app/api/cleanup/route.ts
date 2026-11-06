import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { createOperation } from '@/services/cleanup/cleanup';
import { createCleanupSchema } from '@/validators/cleanup';

/** POST /api/cleanup – nouvelle opération de curage (agent, administrateur). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const parsed = await parseJson(request, createCleanupSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({ data: await createOperation(user, parsed.data) }, { status: 201 });
  });
}
