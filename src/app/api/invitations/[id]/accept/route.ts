import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson } from '@/lib/api/route';
import { setSessionCookie } from '@/lib/auth/session';
import { acceptInvitation } from '@/services/invitations/invitations';
import { password, personName } from '@/validators/auth';

// Le segment s'appelle [id] (même niveau que DELETE /api/invitations/:id) mais porte ici
// le jeton d'invitation, conformément à l'API du cahier des charges (§10).
type Context = { params: Promise<{ id: string }> };

const acceptSchema = z.strictObject({ name: personName, password });

/** POST /api/invitations/:token/accept – activation du compte invité. */
export async function POST(request: Request, { params }: Context) {
  return mutation(
    request,
    async () => {
      const parsed = await parseJson(request, acceptSchema);
      if ('response' in parsed) return parsed.response;
      const { id: token } = await params;
      const { session } = await acceptInvitation(token, parsed.data.name, parsed.data.password);
      await setSessionCookie(session.token, session.expiresAt);
      return NextResponse.json({ data: { accepted: true } }, { status: 201 });
    },
    { rateLimit: 'token' },
  );
}
