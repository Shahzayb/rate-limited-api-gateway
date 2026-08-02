import redisClient from '../db/redis.js';

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  resetSeconds: number;
}

/**
 * Atomically checks and updates the request window in a single Redis step.
 */
export async function checkAndUpdateRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Convert windowSeconds to windowMs for the Lua script
  const windowMs = windowSeconds * 1000;

  const { current, limit, oldestScore, now, allowed } = await redisClient.rateLimit(
    key,
    maxRequests,
    windowMs
  );

  // Calculate resetSeconds based on the oldest entry in the sliding window
  const resetSeconds = Math.ceil(Math.max(0, oldestScore + windowMs - now) / 1000);

  return {
    allowed,
    current,
    limit,
    resetSeconds,
  };
}
