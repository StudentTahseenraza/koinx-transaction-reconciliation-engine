import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment variable validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('localhost'),

  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/reconciliation_engine'),

  // Matching tolerances
  TIMESTAMP_TOLERANCE_SECONDS: z.string().default('300'),
  QUANTITY_TOLERANCE_PCT: z.string().default('0.01'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // File upload
  MAX_FILE_SIZE_MB: z.string().default('10'),
});

// Parse and validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

// Export typed configuration
export const config = {
  env: parsedEnv.data.NODE_ENV,
  port: parseInt(parsedEnv.data.PORT, 10),
  host: parsedEnv.data.HOST,

  mongodb: {
    uri: parsedEnv.data.MONGODB_URI,
    options: {
      retryWrites: true,
      w: 'majority' as const,
    },
  },

  reconciliation: {
    timestampToleranceSeconds: parseInt(parsedEnv.data.TIMESTAMP_TOLERANCE_SECONDS, 10),
    quantityTolerancePct: parseFloat(parsedEnv.data.QUANTITY_TOLERANCE_PCT),
  },

  logging: {
    level: parsedEnv.data.LOG_LEVEL,
  },

  rateLimit: {
    windowMs: parseInt(parsedEnv.data.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(parsedEnv.data.RATE_LIMIT_MAX_REQUESTS, 10),
  },

  upload: {
    maxFileSizeMB: parseInt(parsedEnv.data.MAX_FILE_SIZE_MB, 10),
    allowedTypes: ['text/csv', 'application/vnd.ms-excel'],
  },

  api: {
    version: 'v1',
    prefix: '/api',
  },
} as const;

// Type export for TypeScript
export type Config = typeof config;