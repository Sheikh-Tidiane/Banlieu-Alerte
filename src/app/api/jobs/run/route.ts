import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { toErrorResponse } from '@/lib/api/handle';
import { hasCronSecret } from '@/lib/auth/cron';
import { runScheduledJobs } from '@/jobs/run-all';

export const dynamic = 'force-dynamic';

/** POST /api/jobs/run – tâche planifiée unique (D-057), réservée au planificateur (CRON_SECRET). */
export async function POST(request: Request) {
  if (hasCronSecret(request) !== true) {
    return apiError('FORBIDDEN', 'Secret de planification requis.');
  }
  try {
    return NextResponse.json({ data: await runScheduledJobs() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
