import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { redeemRecoveryCode } from '@/services/auth/mfa';

const schema = z.strictObject({ code: z.string().trim().min(6).max(20) });

/** POST /api/auth/mfa/recovery – code de secours, à usage unique. */
export async function POST(request: Request) {
  return mutation(
    request,
    async () => {
      const user = await requireUser();
      const parsed = await parseJson(request, schema);
      if ('response' in parsed) return parsed.response;
      return NextResponse.json({ data: await redeemRecoveryCode(user, parsed.data.code) });
    },
    { rateLimit: 'login' },
  );
}
