import { NextResponse } from 'next/server';
import { mutation, parseJson, query } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { createInvitation, listPendingInvitations } from '@/services/invitations/invitations';
import { invitationSchema } from '@/validators/auth';

export const dynamic = 'force-dynamic';

/** GET /api/invitations – invitations en attente (administrateur). */
export async function GET() {
  return query(async () => {
    const admin = await requireUser(['ADMIN']);
    return NextResponse.json({ data: await listPendingInvitations(admin) });
  });
}

/** POST /api/invitations – invite un délégué, un agent ou un administrateur (EXG-33). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const parsed = await parseJson(request, invitationSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({ data: await createInvitation(admin, parsed.data) }, { status: 201 });
  });
}
