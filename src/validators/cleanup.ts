import { z } from 'zod';

export const createCleanupSchema = z.strictObject({
  trackingCode: z.string().trim().min(5).max(20),
  team: z.string().trim().min(2).max(160),
  plannedFor: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const updateCleanupSchema = z.strictObject({
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  note: z.string().trim().max(1000).optional(),
  resolveReport: z.boolean().optional(),
});
