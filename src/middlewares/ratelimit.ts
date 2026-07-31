import type { Request, Response, NextFunction } from 'express';
import { getRateLimitConfig } from '../utils/rateLimitConfigLoader.js';
import { logger } from '../logger.js';
import { checkAndUpdateRateLimit } from '../utils/checkAndUpdateRatelimit.js';

export async function ratelimit(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const path = req.path;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key must be a string' });
  }

  let rateLimitConfig;
  try {
    rateLimitConfig = await getRateLimitConfig(apiKey, path);
  } catch (error) {
    logger.error(error, 'Error fetching rate limit config:');
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  const key = `ratelimit:${apiKey}:${path}`;

  const { currentRequests, ttl } = await checkAndUpdateRateLimit(
    key,
    rateLimitConfig.maxRequests,
    rateLimitConfig.windowSeconds
  );

  logger.info({ currentRequests, ttl }, `Current requests for API key ${apiKey} and path ${path}:`);

  const remainingRequests = Math.max(0, rateLimitConfig.maxRequests - currentRequests);

  logger.info({ remainingRequests }, `Remaining requests for API key ${apiKey} and path ${path}:`);

  res.setHeader('X-RateLimit-Limit', rateLimitConfig.maxRequests);
  res.setHeader('X-RateLimit-Remaining', remainingRequests);

  if (currentRequests > rateLimitConfig.maxRequests) {
    const retryAfter = ttl > 0 ? ttl : rateLimitConfig.windowSeconds;
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
}
