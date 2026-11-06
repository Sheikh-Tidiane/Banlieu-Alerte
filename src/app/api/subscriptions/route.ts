import { NextResponse } from 'next/server';
import { mutation, parseJson, query } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { createSubscription, listMySubscriptions } from '@/services/subscriptions/subscriptions';
import { createSubscriptionSchema } from '@/validators/subscriptions';

export const dynamic = 'force-dynamic';

/** GET /api/subscriptions – abonnements du compte connecté. */
export async function GET() {
  return query(async () => {
    const user = await requireUser();
    return NextResponse.json({ data: await listMySubscriptions(user) });
  });
}

/** POST /api/subscriptions – abonnement par quartier(s) ou par position et rayon (EXG-11). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const user = await requireUser();
    const parsed = await parseJson(request, createSubscriptionSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json(
      { data: await createSubscription(user, parsed.data) },
      { status: 201 },
    );
  });
}
