import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { answerFeedbackPrompt } from '@/services/episodes/episodes';
import { feedbackAnswerSchema } from '@/validators/episodes';

/** POST /api/feedback/flooded – « Votre rue a-t-elle été inondée ? » (indice, jamais étiquette). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser();
    const parsed = await parseJson(request, feedbackAnswerSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({
      data: await answerFeedbackPrompt(user, parsed.data.promptId, parsed.data.answer),
    });
  });
}
