import { NextResponse } from 'next/server';
import { mutation } from '@/lib/api/route';
import {
  clearSessionCookie,
  getCurrentUser,
  readSessionToken,
  revokeSession,
} from '@/lib/auth/session';
import { recordAudit } from '@/services/audit';

/** POST /api/auth/logout – invalide la session côté serveur, puis efface le cookie. */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await getCurrentUser();
    const token = await readSessionToken();
    if (token) await revokeSession(token);
    await clearSessionCookie();
    if (user)
      await recordAudit({
        actorId: user.id,
        action: 'auth.logout',
        entityType: 'user',
        entityId: user.id,
      });
    return NextResponse.json({ data: { loggedOut: true } });
  });
}
