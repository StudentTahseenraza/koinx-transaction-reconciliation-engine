import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

export const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for reconciliation endpoint
export const reconciliationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    status: 'error',
    message: 'Too many reconciliation requests. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});