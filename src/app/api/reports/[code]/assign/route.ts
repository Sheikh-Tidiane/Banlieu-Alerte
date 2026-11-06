import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { assignReport } from '@/services/backoffice/processing';
import { assignSchema } from '@/validators/backoffice';

type Context = { params: Promise<{ code: string }> };

/** POST /api/reports/:code/assign – assignation à un agent (ou retrait). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const parsed = await parseJson(request, assignSchema);
    if ('response' in parsed) return parsed.response;
    const { code } = await params;
    return NextResponse.json({ data: await assignReport(user, code, parsed.data.assigneeId) });
  });
}
