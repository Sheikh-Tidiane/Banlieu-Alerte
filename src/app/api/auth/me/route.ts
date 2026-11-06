import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isStaff } from '@/permissions/policies';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me – compte connecté (nom et rôle seulement), pour l'en-tête. */
export async function GET() {
  const user = await getCurrentUser();
  const data = user ? { name: user.name, role: user.role, isStaff: isStaff(user) } : null;
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
