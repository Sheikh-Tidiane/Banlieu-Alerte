import { z } from 'zod';

// Sans évaluation dynamique de code : la CSP de production interdit « eval » (D-066), et la
// détection automatique de Zod provoquerait une violation signalée par le navigateur.
z.config({ jitless: true });
import { SERVICE_AREA } from '@/lib/geo/distance';

// Schémas partagés client et serveur (D-023). Aucune dépendance au client Prisma ici :
// ce fichier est aussi chargé dans le navigateur.

import { REPORT_STATUSES, REPORT_TYPES, SEVERITIES } from '@/lib/reports/constants';

export { REPORT_STATUSES, REPORT_TYPES, SEVERITIES };
export type { ReportStatus, ReportType, Severity } from '@/lib/reports/constants';

export const DESCRIPTION_MAX = 500;
/** Durée minimale de saisie : en dessous, il s'agit presque toujours d'un robot (D-028). */
export const MIN_FILL_DURATION_MS = 3000;

const latitude = z.coerce
  .number({ message: 'Position invalide.' })
  .min(SERVICE_AREA.minLat, 'Cette position est hors de la zone couverte.')
  .max(SERVICE_AREA.maxLat, 'Cette position est hors de la zone couverte.');
const longitude = z.coerce
  .number({ message: 'Position invalide.' })
  .min(SERVICE_AREA.minLng, 'Cette position est hors de la zone couverte.')
  .max(SERVICE_AREA.maxLng, 'Cette position est hors de la zone couverte.');

/** Champs saisis par l'habitant (formulaire). */
export const reportFormSchema = z.object({
  type: z.enum(REPORT_TYPES, { message: 'Choisissez un type de problème.' }),
  lat: latitude,
  lng: longitude,
  neighborhoodId: z.string().max(40).optional(),
  severity: z.enum(SEVERITIES, { message: 'Indiquez la gravité.' }),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères maximum.`)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type ReportFormValues = z.input<typeof reportFormSchema>;

/** Corps reçu par POST /api/reports (champs du formulaire + champs techniques). */
export const createReportSchema = reportFormSchema.extend({
  clientId: z.uuid().optional(),
  /** Champ piège : invisible pour un humain, rempli par les robots. */
  website: z.string().max(0, 'Envoi refusé.').optional(),
  /**
   * Durée de saisie (ms), mesurée par le navigateur au moment de la validation : elle ne
   * dépend pas du délai d'envoi (file hors-ligne).
   */
  fillDurationMs: z.coerce.number().int().nonnegative().optional(),
  /** L'habitant a vu les signalements proches et confirme qu'il s'agit d'un autre problème. */
  confirmNotDuplicate: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type CreateReportInput = z.output<typeof createReportSchema>;

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      const parts = value.split(',').filter(Boolean);
      for (const part of parts) {
        if (!values.includes(part)) {
          ctx.addIssue({ code: 'custom', message: `Valeur inconnue : ${part}` });
          return z.NEVER;
        }
      }
      return parts as T[number][];
    });

/** Filtres de GET /api/reports (CDC §10 et §4.1). */
export const listReportsSchema = z.object({
  bbox: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      const parts = value.split(',').map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        ctx.addIssue({ code: 'custom', message: 'bbox attendu : minLng,minLat,maxLng,maxLat' });
        return z.NEVER;
      }
      const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
      return { minLng, minLat, maxLng, maxLat };
    }),
  type: csv(REPORT_TYPES),
  status: csv(REPORT_STATUSES),
  severity: csv(SEVERITIES),
  neighborhoodId: z.string().max(40).optional(),
  /** Période : nombre de jours en arrière. */
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export type ListReportsFilters = z.output<typeof listReportsSchema>;

export const abuseSchema = z.object({
  reason: z.string().trim().min(3, 'Précisez le motif.').max(300, '300 caractères maximum.'),
});

export const deviceSchema = z.object({
  /** Identifiant aléatoire de l'appareil (jamais stocké en clair côté serveur). */
  deviceId: z.uuid({ message: 'Appareil non reconnu.' }),
});
