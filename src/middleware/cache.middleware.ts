import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// Initialize cache with 5 minutes TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const cacheMiddleware = (duration: number = 300) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const key = `cache:${req.originalUrl}`;
    const cachedResponse = cache.get(key);

    if (
      cachedResponse &&
      process.env.NODE_ENV !== 'development'
    ) {
      res.status(200).json(cachedResponse);
      return;
    }

    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json function
    res.json = function (body: any): Response {
      if (res.statusCode === 200) {
        cache.set(key, body, duration);
      }

      return originalJson(body);
    };

    next();
  };
};

// Clear cache for specific pattern
export const clearCache = (pattern: string) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
};