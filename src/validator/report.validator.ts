import { z } from 'zod';

export const reportFiltersSchema = z.object({
  category: z.enum(['MATCHED', 'CONFLICTING', 'UNMATCHED_USER', 'UNMATCHED_EXCHANGE']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  asset: z.string().min(1).max(10).optional(),
  minMatchScore: z.number().min(0).max(100).optional(),
  maxMatchScore: z.number().min(0).max(100).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50)
});

export const reconciliationConfigSchema = z.object({
  timestampToleranceSeconds: z.number().min(0).max(3600).default(300),
  quantityTolerancePct: z.number().min(0).max(100).default(0.01),
  webhookUrl: z.string().url().optional()
});

export const transactionQuerySchema = z.object({
  transactionId: z.string().min(1),
  runId: z.string().min(1)
});