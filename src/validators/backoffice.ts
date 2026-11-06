import { z } from 'zod';
import { REPORT_STATUSES, REPORT_TYPES, SEVERITIES } from './report';

export const statusChangeSchema = z
  .strictObject({
    status: z.enum(REPORT_STATUSES, { message: 'Statut inconnu.' }),
    reason: z.string().trim().max(500, '500 caractères maximum.').optional(),
  })
  .refine((value) => value.status !== 'REJECTED' || Boolean(value.reason), {
    message: 'Motif obligatoire pour un rejet.',
    path: ['reason'],
  });

export const assignSchema = z.strictObject({
  /** null : retirer l'assignation. */
  assigneeId: z.string().max(40).nullable(),
});

export const noteSchema = z.strictObject({
  body: z.string().trim().min(2, 'Note trop courte.').max(2000, '2 000 caractères maximum.'),
});

export const mergeSchema = z.strictObject({
  primaryCode: z.string().trim().toUpperCase().max(20),
});

const list = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) =>
      Array.isArray(value) ? value : typeof value === 'string' && value ? value.split(',') : [],
    z.array(z.enum(values)),
  );

/** Filtres du tableau des signalements (paramètres d'URL). */
export const staffListSchema = z.object({
  status: list(REPORT_STATUSES),
  type: list(REPORT_TYPES),
  severity: list(SEVERITIES),
  neighborhoodId: z.string().max(40).optional().catch(undefined),
  assigned: z.enum(['me', 'none']).optional().catch(undefined),
  unidentified: z
    .enum(['1'])
    .optional()
    .catch(undefined)
    .transform((value) => value === '1'),
  q: z.string().trim().toUpperCase().max(20).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type StaffListFilters = z.output<typeof staffListSchema>;

export const commentSchema = z.strictObject({
  body: z.string().trim().min(2, 'Commentaire trop court.').max(1000, '1 000 caractères maximum.'),
});

export const hideSchema = z.strictObject({ hidden: z.boolean() });
