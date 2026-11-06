import { z } from 'zod';
import { RISK_LEVELS } from '@/lib/risk/types';

// Alertes (CDC §4.6). Une alerte indicative n'emprunte jamais le vocabulaire officiel.

export const MAX_VALIDITY_HOURS = 7 * 24;

/** Termes réservés aux alertes officielles (émetteur institutionnel). */
export const OFFICIAL_VOCABULARY =
  /officiel|mairie|préfecture|prefecture|protection civile|gouvernement|ministère|sapeurs-pompiers/i;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const neighborhoodIds = z.array(z.string().min(1).max(40)).min(1).max(20);
const date = z.coerce.date();

const editableFields = {
  level: z.enum(RISK_LEVELS),
  issuerName: text(3, 160),
  title: text(5, 160),
  messageFr: text(10, 1000),
  messageWo: optionalText(1000),
  woReviewed: z.boolean().default(false),
  advice: optionalText(1000),
  neighborhoodIds,
  validFrom: date.optional(),
  validUntil: date,
  scheduledAt: date.optional(),
};

type Checked = {
  type?: 'OFFICIAL' | 'INDICATIVE';
  issuerName?: string;
  title?: string;
  validFrom?: Date;
  validUntil?: Date;
  messageWo?: string;
  woReviewed?: boolean;
};

/** Règles communes à la création et à la modification. */
export function alertIssues(value: Checked, now = new Date()): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const from = value.validFrom ?? now;
  if (value.validUntil) {
    if (value.validUntil <= from)
      issues.push({ path: 'validUntil', message: 'La fin de validité doit suivre le début.' });
    else if (value.validUntil.getTime() - from.getTime() > MAX_VALIDITY_HOURS * 3_600_000)
      issues.push({ path: 'validUntil', message: 'Validité limitée à 7 jours.' });
  }
  if (value.type === 'INDICATIVE') {
    for (const field of ['issuerName', 'title'] as const) {
      if (value[field] && OFFICIAL_VOCABULARY.test(value[field])) {
        issues.push({
          path: field,
          message: 'Une alerte indicative ne peut pas reprendre le vocabulaire officiel.',
        });
      }
    }
  }
  if (value.woReviewed && !value.messageWo) {
    issues.push({ path: 'messageWo', message: 'Message en wolof manquant.' });
  }
  return issues;
}

function refineAlert(value: Checked, ctx: z.RefinementCtx) {
  for (const issue of alertIssues(value)) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  }
}

export const createAlertSchema = z
  .object({ type: z.enum(['OFFICIAL', 'INDICATIVE']), ...editableFields })
  .strict()
  .superRefine(refineAlert);

/** Modification d'un brouillon, ou modifications faites au moment d'approuver. */
export const alertChangesSchema = z
  .object({
    level: editableFields.level.optional(),
    issuerName: editableFields.issuerName.optional(),
    title: editableFields.title.optional(),
    messageFr: editableFields.messageFr.optional(),
    messageWo: editableFields.messageWo,
    woReviewed: z.boolean().optional(),
    advice: editableFields.advice,
    neighborhoodIds: neighborhoodIds.optional(),
    validUntil: date.optional(),
    scheduledAt: date.optional(),
  })
  .strict();

export const approveAlertSchema = z
  .object({ changes: alertChangesSchema.optional(), reason: optionalText(500) })
  .strict();

export const reasonSchema = z.object({ reason: text(5, 500) }).strict();

export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type AlertChanges = z.infer<typeof alertChangesSchema>;
