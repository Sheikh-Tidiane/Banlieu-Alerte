import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson, query } from '@/lib/api/route';
import { getCurrentUser } from '@/lib/auth/session';
import { requireUser } from '@/permissions/require';
import { answerResolution, getResolutionFeedbackState } from '@/services/reports/feedback';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ code: string }> };

const feedbackSchema = z.strictObject({ resolved: z.boolean() });

/** GET /api/reports/:code/feedback – la question « résolu ? » est-elle posée au compte connecté ? */
export async function GET(_request: Request, { params }: Context) {
  return query(async () => {
    const { code } = await params;
    return NextResponse.json({
      data: await getResolutionFeedbackState(await getCurrentUser(), code),
    });
  });
}

/** POST /api/reports/:code/feedback – réponse de l'auteur ; « non » rouvre le dossier (EXG-32). */
export async function POST(request: Request, { params }: Context) {
  return mutation(request, async () => {
    const user = await requireUser();
    const parsed = await parseJson(request, feedbackSchema);
    if ('response' in parsed) return parsed.response;
    const { code } = await params;
    return NextResponse.json({ data: await answerResolution(user, code, parsed.data.resolved) });
  });
}
