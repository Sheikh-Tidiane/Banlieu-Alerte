import { NextResponse } from 'next/server';
import { mutation, parseJson, query } from '@/lib/api/route';
import { clearSessionCookie } from '@/lib/auth/session';
import { requireUser } from '@/permissions/require';
import { deleteMyAccount, exportMyData, updateProfile } from '@/services/account/account';
import { profileSchema } from '@/validators/auth';

export const dynamic = 'force-dynamic';

/** GET /api/account – export de toutes mes données (JSON téléchargeable). */
export async function GET() {
  return query(async () => {
    const user = await requireUser();
    const data = await exportMyData(user);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="banlieue-alerte-mes-donnees.json"',
        'Cache-Control': 'no-store',
      },
    });
  });
}

/** PATCH /api/account – nom et langue. */
export async function PATCH(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser();
    const parsed = await parseJson(request, profileSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({ data: await updateProfile(user, parsed.data) });
  });
}

/** DELETE /api/account – suppression du compte (signalements anonymisés et conservés). */
export async function DELETE(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser();
    const result = await deleteMyAccount(user);
    await clearSessionCookie();
    return NextResponse.json({ data: result });
  });
}
