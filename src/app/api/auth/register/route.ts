import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { setSessionCookie } from '@/lib/auth/session';
import { register } from '@/services/auth/credentials';
import { registerSchema } from '@/validators/auth';

/** POST /api/auth/register – inscription libre, citoyen uniquement (EXG-33). */
export async function POST(request: Request) {
  return mutation(
    request,
    async () => {
      const parsed = await parseJson(request, registerSchema);
      if ('response' in parsed) return parsed.response;
      const { session } = await register(parsed.data);
      await setSessionCookie(session.token, session.expiresAt);
      return NextResponse.json({ data: { registered: true } }, { status: 201 });
    },
    { rateLimit: 'register' },
  );
}
