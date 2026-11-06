import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { setSessionCookie } from '@/lib/auth/session';
import { login } from '@/services/auth/credentials';
import { loginSchema } from '@/validators/auth';

/** POST /api/auth/login – connexion par e-mail et mot de passe. */
export async function POST(request: Request) {
  return mutation(
    request,
    async () => {
      const parsed = await parseJson(request, loginSchema);
      if ('response' in parsed) return parsed.response;
      const { session, secondFactorRequired } = await login(parsed.data);
      await setSessionCookie(session.token, session.expiresAt);
      return NextResponse.json({ data: { loggedIn: true, secondFactorRequired } });
    },
    { rateLimit: 'login' },
  );
}
