import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { confirmEnrollment } from '@/services/auth/mfa';

const schema = z.strictObject({ code: z.string().trim().min(6).max(20) });

/** POST /api/auth/mfa/confirm – premier code : active le second facteur, renvoie les codes de secours. */
export async function POST(request: Request) {
  return mutation(
    request,
    async () => {
      const user = await requireUser();
      const parsed = await parseJson(request, schema);
      if ('response' in parsed) return parsed.response;
      return NextResponse.json({ data: await confirmEnrollment(user, parsed.data.code) });
    },
    { rateLimit: 'login' },
  );
}
