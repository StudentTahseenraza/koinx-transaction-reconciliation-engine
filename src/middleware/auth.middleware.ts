import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

// Simple API key authentication (for production)
export const authenticate = (req: Request, _: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;
  
  // Skip authentication in development
  if (process.env.NODE_ENV === 'development' && !validApiKey) {
    return next();
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    throw new AppError('Invalid or missing API key', 401);
  }
  
  next();
};

// Rate limiting based on user role
export const roleBasedRateLimit = (_: 'standard' | 'premium') => {
  return (_: Request, next: NextFunction) => {
    // Implement role-based rate limiting logic
    // This could be stored in Redis or memory
    next();
  };
};