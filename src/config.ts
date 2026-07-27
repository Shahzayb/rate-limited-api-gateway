import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
  RATE_LIMIT_WINDOW: z.string().default('10'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('5'),
  CACHE_TTL: z.string().default('300'), // 5 minutes
});

try {
  envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  process.exit(1);
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}

export const config = {
  NODE_ENV: process.env.NODE_ENV,
  REDIS_URL: process.env.REDIS_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '10', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10),
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '300', 10),
};

export function getEnvRateLimitConfig(path: string) {
  const window = process.env[`RATE_LIMIT_${path.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_WINDOW`];
  const maxRequests =
    process.env[`RATE_LIMIT_${path.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_MAX_REQUESTS`];

  return {
    window: window ? parseInt(window, 10) : config.RATE_LIMIT_WINDOW,
    maxRequests: maxRequests ? parseInt(maxRequests, 10) : config.RATE_LIMIT_MAX_REQUESTS,
  };
}
