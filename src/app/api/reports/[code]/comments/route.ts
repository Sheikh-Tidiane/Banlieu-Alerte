import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { addComment } from '@/services/reports/comments';
import { commentSchema } from '@/validators/backoffice';

type Context = { params: Promise<{ code: string }> };

/** POST /api/reports/:code/comments – commentaire public, compte connecté obligatoire. */
export async function POST(request: Request, { params }: Context) {
  return mutation(
    request,
    async () => {
      const user = await requireUser();
      const parsed = await parseJson(request, commentSchema);
      if ('response' in parsed) return parsed.response;
      const { code } = await params;
      return NextResponse.json(
        { data: await addComment(user, code, parsed.data.body) },
        { status: 201 },
      );
    },
    { rateLimit: 'comment' },
  );
}
