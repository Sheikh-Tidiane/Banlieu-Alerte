import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { mutation } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { isDemoMode, resetDemo } from '@/services/demo/simulator';

/** POST /api/demo/reset – suppression des seules données du simulateur. */
export async function POST(request: Request) {
  if (!isDemoMode()) return apiError('NOT_FOUND', 'Mode démonstration désactivé.');
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    return NextResponse.json({ data: await resetDemo(admin) });
  });
}
