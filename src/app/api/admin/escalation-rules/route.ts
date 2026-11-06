import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import { updateEscalationRules } from '@/services/escalation/escalation';
import { REPORT_TYPES, SEVERITIES } from '@/validators/report';

const rulesSchema = z.strictObject({
  rules: z
    .array(
      z.strictObject({
        type: z.enum(REPORT_TYPES).nullable(),
        severity: z.enum(SEVERITIES).nullable(),
        targetHours: z.number().int().min(1).max(720),
      }),
    )
    .min(1)
    .max(30),
});

/** POST /api/admin/escalation-rules – délais de première réponse (administrateur). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const parsed = await parseJson(request, rulesSchema);
    if ('response' in parsed) return parsed.response;
    return NextResponse.json({ data: await updateEscalationRules(admin, parsed.data.rules) });
  });
}
