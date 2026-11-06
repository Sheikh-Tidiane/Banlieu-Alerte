import { NextResponse } from 'next/server';
import { mutation, query } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import {
  listMyUserNotifications,
  markUserNotificationsRead,
} from '@/services/notifications/user-notifications';

export const dynamic = 'force-dynamic';

/** GET /api/account/followup – notifications d'avancement du compte connecté. */
export async function GET() {
  return query(async () => {
    const user = await requireUser();
    return NextResponse.json({ data: await listMyUserNotifications(user) });
  });
}

/** POST /api/account/followup – tout marquer comme lu. */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser();
    return NextResponse.json({ data: await markUserNotificationsRead(user) });
  });
}
