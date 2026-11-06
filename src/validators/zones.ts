import { z } from 'zod';
import { SERVICE_AREA } from '@/lib/geo/distance';

const name = z.string().trim().min(2, '2 caractères minimum.').max(120, '120 caractères maximum.');

export const communeSchema = z.strictObject({
  name,
  department: z.string().trim().min(2).max(120).default('Pikine'),
});

export const neighborhoodSchema = z.strictObject({
  name,
  communeId: z.string().min(1).max(40),
  isPilot: z.boolean().optional(),
  boundaryStatus: z.enum(['APPROXIMATE', 'VALIDATED']).optional(),
  delegateId: z.string().max(40).nullable().optional(),
});

export const neighborhoodUpdateSchema = neighborhoodSchema.omit({ communeId: true }).partial();

export const landmarkSchema = z.strictObject({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(['MARKET', 'SCHOOL', 'MOSQUE', 'STATION', 'HEALTH', 'OTHER']),
  lat: z
    .number()
    .min(SERVICE_AREA.minLat, 'Hors de la zone couverte.')
    .max(SERVICE_AREA.maxLat, 'Hors de la zone couverte.'),
  lng: z
    .number()
    .min(SERVICE_AREA.minLng, 'Hors de la zone couverte.')
    .max(SERVICE_AREA.maxLng, 'Hors de la zone couverte.'),
  radiusMeters: z.number().int().min(50, '50 m minimum.').max(3000, '3 000 m maximum.'),
  /** Source du repère : obligatoire (CDC §4.5, DECISIONS.md). */
  source: z.string().trim().min(3, 'Indiquez la source du repère.').max(200),
});

export const aliasSchema = z.strictObject({
  alias: z.string().trim().min(2).max(160),
  locale: z.enum(['fr', 'wo']).default('fr'),
});

export type CommuneInput = z.output<typeof communeSchema>;
export type NeighborhoodInput = z.output<typeof neighborhoodSchema>;
export type LandmarkInput = z.output<typeof landmarkSchema>;
export type AliasInput = z.output<typeof aliasSchema>;

/** Corps de POST /api/admin/zones : une action par requête. */
export const zoneActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('createCommune'), data: communeSchema }),
  z.strictObject({ action: z.literal('createNeighborhood'), data: neighborhoodSchema }),
  z.strictObject({
    action: z.literal('updateNeighborhood'),
    id: z.string().min(1).max(40),
    data: neighborhoodUpdateSchema,
  }),
  z.strictObject({
    action: z.literal('addLandmark'),
    neighborhoodId: z.string().min(1).max(40),
    data: landmarkSchema,
  }),
  z.strictObject({
    action: z.literal('addAlias'),
    neighborhoodId: z.string().min(1).max(40),
    data: aliasSchema,
  }),
  z.strictObject({
    action: z.literal('delete'),
    kind: z.enum(['landmark', 'alias']),
    id: z.string().min(1).max(40),
  }),
]);
