import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { createPasswordReset } from '@/services/invitations/invitations';
import { userIdSchema } from '@/validators/auth';

/** POST /api/password-resets – lien de réinitialisation créé par un administrateur. */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const parsed = await parseJson(request, userIdSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json(
      { data: await createPasswordReset(admin, parsed.data.userId) },
      { status: 201 },
    );
  });
}
