import { NextResponse } from 'next/server';
import { getHealth } from '@/services/supervision/health';

export const dynamic = 'force-dynamic';

/**
 * Point de santé (EXG-37) : base, fraîcheur de l'indice, tâche planifiée, erreurs météo,
 * échecs d'envoi, modes actifs. Uniquement des compteurs et des dates.
 */
export async function GET() {
  const health = await getHealth();
  return NextResponse.json(health, { status: health.checks.database === 'ok' ? 200 : 503 });
}
