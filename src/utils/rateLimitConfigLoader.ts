import { config, getEnvRateLimitConfig } from '../config.js';
import redisClient from '../db/redis.js';
import pgPool from '../db/postgres.js';
import { logger } from '../logger.js';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  windowSeconds: config.RATE_LIMIT_WINDOW,
};

export async function getRateLimitConfig(apiKey: string, path: string): Promise<RateLimitConfig> {
  const cacheKey = `config:${apiKey}:${path}`;

  // 1. Check Redis Cache
  const cachedConfig = await redisClient.get(cacheKey);
  if (cachedConfig) {
    return JSON.parse(cachedConfig);
  }

  // 2. Query PostgreSQL
  try {
    const { rows } = await pgPool.query(
      'SELECT max_requests, window_seconds FROM rate_limit_config WHERE api_key = $1 AND path = $2',
      [apiKey, path]
    );

    if (rows.length > 0) {
      const dbConfig: RateLimitConfig = {
        maxRequests: rows[0].max_requests,
        windowSeconds: rows[0].window_seconds,
      };
      await redisClient.setEx(cacheKey, config.CACHE_TTL, JSON.stringify(dbConfig));
      return dbConfig;
    }
  } catch (error) {
    logger.error(error, 'Error fetching rate limit config from DB:');
    // Fallback to environment variables if DB query fails
  }

  // 3. Fallback to Environment Variables
  const envConfig = getEnvRateLimitConfig(path);
  const finalConfig = {
    maxRequests: envConfig.maxRequests || DEFAULT_RATE_LIMIT_CONFIG.maxRequests,
    windowSeconds: envConfig.window || DEFAULT_RATE_LIMIT_CONFIG.windowSeconds,
  };

  // Cache environment variable config in Redis as well
  await redisClient.setEx(cacheKey, config.CACHE_TTL, JSON.stringify(finalConfig));

  return finalConfig;
}
