import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { getCurrentUser } from '@/lib/auth/session';
import { flagComment } from '@/services/reports/comments';
import { abuseSchema } from '@/validators/report';

type Context = { params: Promise<{ id: string }> };

/** POST /api/comments/:id/abuse – signaler un commentaire. */
export async function POST(request: Request, { params }: Context) {
  return mutation(
    request,
    async () => {
      const parsed = await parseJson(request, abuseSchema);
      if ('response' in parsed) return parsed.response;
      const { id } = await params;
      const user = await getCurrentUser();
      return NextResponse.json(
        { data: await flagComment(id, parsed.data.reason, user?.id ?? null) },
        { status: 201 },
      );
    },
    { rateLimit: 'abuse' },
  );
}
