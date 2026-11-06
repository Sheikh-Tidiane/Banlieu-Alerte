import { z } from 'zod';
import { FACTOR_KEYS, type FactorKey, type RuleParams } from '@/lib/risk/types';

const factorRuleSchema = z
  .object({
    maxPoints: z.number().int().min(0).max(100),
    direction: z.enum(['higher', 'lower']),
    thresholds: z.tuple([z.number(), z.number(), z.number()]),
  })
  .strict()
  .refine(
    ({ direction, thresholds: [a, b, c] }) =>
      direction === 'higher' ? a < b && b < c : a > b && b > c,
    { message: 'Les bornes des paliers doivent progresser dans le sens du facteur.' },
  );

const factorsShape = Object.fromEntries(
  FACTOR_KEYS.map((key) => [key, factorRuleSchema]),
) as Record<FactorKey, typeof factorRuleSchema>;

export const ruleParamsSchema: z.ZodType<RuleParams> = z
  .object({
    factors: z.object(factorsShape).strict(),
    levels: z
      .object({
        moderate: z.number().int().min(1).max(99),
        high: z.number().int().min(1).max(99),
        critical: z.number().int().min(1).max(100),
      })
      .strict()
      .refine(({ moderate, high, critical }) => moderate < high && high < critical, {
        message: 'Les seuils de niveaux doivent être croissants.',
      }),
    noRainMaxScore: z.number().int().min(0).max(100).nullable(),
  })
  .strict()
  .refine(
    ({ factors }) => Object.values(factors).reduce((sum, f) => sum + f.maxPoints, 0) === 100,
    { message: 'La somme des points maximum doit être égale à 100.' },
  );

/** Actions de l'administrateur sur la grille (une par requête). */
export const ruleActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      name: z.string().trim().min(3).max(160),
      notes: z.string().trim().max(2000).optional(),
      params: ruleParamsSchema,
      activate: z.boolean().default(false),
    })
    .strict(),
  z.object({ action: z.literal('activate'), versionId: z.string().min(1).max(40) }).strict(),
]);

export const horizonSchema = z.coerce
  .number()
  .refine((value): value is 24 | 48 => value === 24 || value === 48, {
    message: 'Horizon : 24 ou 48.',
  });
