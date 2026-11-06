import { NextResponse } from 'next/server';
import { mutation, query } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { listMyNotifications, markNotificationsRead } from '@/services/subscriptions/subscriptions';

export const dynamic = 'force-dynamic';

/** GET /api/account/notifications – notifications reçues par le compte. */
export async function GET() {
  return query(async () => {
    const user = await requireUser();
    return NextResponse.json({ data: await listMyNotifications(user) });
  });
}

/** POST /api/account/notifications – tout marquer comme lu. */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser();
    return NextResponse.json({ data: await markNotificationsRead(user) });
  });
}
