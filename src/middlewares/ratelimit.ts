import type { Request, Response, NextFunction } from 'express';
import redisClient from '../db/redis.js';
import { getRateLimitConfig } from '../utils/rateLimitConfigLoader.js';
import { logger } from '../logger.js';

async function updateRequestWindow(apiKey: string, path: string, windowSeconds: number) {
  const key = `ratelimit:${apiKey}:${path}`;
  const currentCount = await redisClient.incr(key);
  if (currentCount === 1) {
    await redisClient.expire(key, windowSeconds);
  }
  return currentCount;
}

async function getRequestWindow(apiKey: string, path: string) {
  const key = `ratelimit:${apiKey}:${path}`;
  const count = await redisClient.get(key);
  return parseInt(count || '0', 10);
}

export async function ratelimit(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const path = req.path;

  if (typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key must be a string' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  let rateLimitConfig;
  try {
    rateLimitConfig = await getRateLimitConfig(apiKey, path);
  } catch (error) {
    console.error('Error fetching rate limit config:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  const currentRequests = await getRequestWindow(apiKey, path);

  logger.info({ currentRequests }, `Current requests for API key ${apiKey} and path ${path}:`);

  const remainingRequests = Math.max(0, rateLimitConfig.maxRequests - currentRequests);

  logger.info({ remainingRequests }, `Remaining requests for API key ${apiKey} and path ${path}:`);

  res.setHeader('X-RateLimit-Limit', rateLimitConfig.maxRequests);
  res.setHeader('X-RateLimit-Remaining', remainingRequests);

  if (currentRequests >= rateLimitConfig.maxRequests) {
    const ttl = await redisClient.ttl(`ratelimit:${apiKey}:${path}`);
    const retryAfter = ttl > 0 ? ttl : rateLimitConfig.windowSeconds;
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  await updateRequestWindow(apiKey, path, rateLimitConfig.windowSeconds);

  next();
}
