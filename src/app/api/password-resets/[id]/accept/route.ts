import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson } from '@/lib/api/route';
import { setSessionCookie } from '@/lib/auth/session';
import { consumePasswordReset } from '@/services/invitations/invitations';
import { password } from '@/validators/auth';

// [id] porte le jeton de réinitialisation.
type Context = { params: Promise<{ id: string }> };

const resetSchema = z.strictObject({ password });

/** POST /api/password-resets/:token/accept – nouveau mot de passe (sessions précédentes fermées). */
export async function POST(request: Request, { params }: Context) {
  return mutation(
    request,
    async () => {
      const parsed = await parseJson(request, resetSchema);
      if ('response' in parsed) return parsed.response;
      const { id: token } = await params;
      const { session } = await consumePasswordReset(token, parsed.data.password);
      await setSessionCookie(session.token, session.expiresAt);
      return NextResponse.json({ data: { reset: true } });
    },
    { rateLimit: 'token' },
  );
}
