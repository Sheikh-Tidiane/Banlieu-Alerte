import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { verifySecondFactor } from '@/services/auth/mfa';

const schema = z.strictObject({ code: z.string().trim().min(6).max(20) });

/** POST /api/auth/mfa/verify – code de l'application à la connexion (EXG-41). */
export async function POST(request: Request) {
  return mutation(
    request,
    async () => {
      const user = await requireUser();
      const parsed = await parseJson(request, schema);
      if ('response' in parsed) return parsed.response;
      return NextResponse.json({ data: await verifySecondFactor(user, parsed.data.code) });
    },
    { rateLimit: 'login' },
  );
}
