import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { activateRuleVersion, createRuleVersion } from '@/services/risk/rules';
import { ruleActionSchema } from '@/validators/risk';

/** POST /api/admin/rules – nouvelle version de la grille, ou activation (retour en arrière). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const parsed = await parseJson(request, ruleActionSchema);
    if ('response' in parsed) return parsed.response;
    const input = parsed.data;
    if (input.action === 'create') {
      return NextResponse.json({ data: await createRuleVersion(admin, input) }, { status: 201 });
    }
    return NextResponse.json({ data: await activateRuleVersion(admin, input.versionId) });
  });
}
