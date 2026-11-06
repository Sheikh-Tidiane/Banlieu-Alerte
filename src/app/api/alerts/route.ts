import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api/errors';
import { mutation, parseJson, query } from '@/lib/api/route';
import { STAFF_ROLES } from '@/permissions/policies';
import { requireUser } from '@/permissions/require';
import { createAlert } from '@/services/alerts/manage';
import { ALERT_STATUSES, listStaffAlerts } from '@/services/alerts/read';
import { createAlertSchema } from '@/validators/alerts';

export const dynamic = 'force-dynamic';

const statusSchema = z.enum(ALERT_STATUSES).optional();

/** GET /api/alerts?status= – alertes de la portée de l'utilisateur (back-office). */
export async function GET(request: Request) {
  return query(async () => {
    const user = await requireUser(STAFF_ROLES);
    const status = statusSchema.safeParse(
      new URL(request.url).searchParams.get('status') ?? undefined,
    );
    if (!status.success) return apiError('VALIDATION_ERROR', 'Statut inconnu.');
    return NextResponse.json({ data: await listStaffAlerts(user, status.data) });
  });
}

/** POST /api/alerts – nouvelle alerte, en attente d'approbation (jamais envoyée à la création). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser(STAFF_ROLES);
    const parsed = await parseJson(request, createAlertSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({ data: await createAlert(user, parsed.data) }, { status: 201 });
  });
}
