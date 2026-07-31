import redisClient from '../db/redis.js';

interface RateLimitResult {
  currentRequests: number;
  ttl: number;
}

/**
 * Atomically checks and updates the request window in a single Redis step.
 */
export async function checkAndUpdateRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const [currentRequests, ttl] = await redisClient.rateLimit(
    key,
    maxRequests.toString(),
    windowSeconds.toString()
  );

  if (currentRequests === undefined || ttl === undefined) {
    throw new Error('Failed to retrieve rate limit data from Redis');
  }

  return {
    currentRequests: currentRequests,
    ttl: ttl,
  };
}
