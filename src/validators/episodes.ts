import { z } from 'zod';

export const createEpisodeSchema = z.strictObject({
  name: z.string().trim().min(3).max(160),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const labelsSchema = z.strictObject({
  labels: z
    .array(
      z.strictObject({
        cellId: z.string().min(1).max(40),
        label: z.enum(['FLOODED', 'NOT_FLOODED', 'UNKNOWN']),
      }),
    )
    .min(1)
    .max(500),
});

export const feedbackAnswerSchema = z.strictObject({
  promptId: z.string().min(1).max(40),
  answer: z.enum(['FLOODED', 'NOT_FLOODED', 'DONT_KNOW']),
});
