import { z } from 'zod';
import dotenv from 'dotenv';

if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: `.env.development` });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url(),
  PG_URL: z.string().url(),
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
  PG_URL: process.env.PG_URL,
};
