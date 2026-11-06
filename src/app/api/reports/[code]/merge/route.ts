import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { mergeReport } from '@/services/backoffice/processing';
import { mergeSchema } from '@/validators/backoffice';

type Context = { params: Promise<{ code: string }> };

/** POST /api/reports/:code/merge – fusion d'un doublon dans un signalement principal (D-038). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser(['AGENT', 'ADMIN']);
    const parsed = await parseJson(request, mergeSchema);
    if ('response' in parsed) return parsed.response;
    const { code } = await params;
    return NextResponse.json({ data: await mergeReport(user, code, parsed.data.primaryCode) });
  });
}
