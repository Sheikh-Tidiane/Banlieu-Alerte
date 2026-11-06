import { z } from 'zod';
import { isInServiceArea } from '@/lib/geo/distance';
import { RISK_LEVELS } from '@/lib/risk/types';

// Abonnement aux alertes (EXG-11) : par quartier(s), ou par position et rayon.

import { RADIUS_OPTIONS } from '@/lib/reports/constants';

export { RADIUS_OPTIONS };
export const MAX_SUBSCRIPTIONS_PER_USER = 5;

const common = {
  minLevel: z.enum(RISK_LEVELS),
  locale: z.enum(['fr', 'wo']),
  channelInApp: z.boolean(),
  channelWebPush: z.boolean(),
};

export const createSubscriptionSchema = z
  .discriminatedUnion('mode', [
    z
      .object({
        mode: z.literal('neighborhoods'),
        neighborhoodIds: z.array(z.string().min(1).max(40)).min(1).max(5),
        ...common,
      })
      .strict(),
    z
      .object({
        mode: z.literal('position'),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusMeters: z
          .number()
          .int()
          .refine((r) => (RADIUS_OPTIONS as readonly number[]).includes(r), {
            message: 'Rayon : 500 m, 1, 2 ou 3 km.',
          }),
        ...common,
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (!value.channelInApp && !value.channelWebPush) {
      ctx.addIssue({
        code: 'custom',
        path: ['channelInApp'],
        message: 'Choisissez au moins un canal.',
      });
    }
    if (value.mode === 'position' && !isInServiceArea(value)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'Position hors de la zone couverte.',
      });
    }
  });

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
