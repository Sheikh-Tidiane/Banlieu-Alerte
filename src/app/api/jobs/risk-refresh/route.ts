import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { toErrorResponse } from '@/lib/api/handle';
import { mutation } from '@/lib/api/route';
import { hasCronSecret } from '@/lib/auth/cron';
import { runRiskJob } from '@/jobs/risk-refresh';
import { requireUser } from '@/permissions/require';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/risk-refresh – recalcul de l'indice (D-048). Deux accès : le planificateur
 * avec `Authorization: Bearer <CRON_SECRET>`, ou un administrateur connecté (bouton).
 */
export async function POST(request: Request) {
  const cron = hasCronSecret(request);
  if (cron === false) return apiError('FORBIDDEN', 'Secret de planification invalide.');
  if (cron === true) {
    try {
      return NextResponse.json({ data: await runRiskJob('cron') });
    } catch (error) {
      return toErrorResponse(error);
    }
  }
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    return NextResponse.json({ data: await runRiskJob('admin', admin.id) });
  });
}
