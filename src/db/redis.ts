import { createClient, defineScript } from 'redis';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const scriptPath = path.resolve(import.meta.dirname, './ratelimit.lua');

if (!fs.existsSync(scriptPath)) {
  throw new Error(`Lua script not found at path: ${scriptPath}`);
}

const rateLimitLua = fs.readFileSync(scriptPath, 'utf8');

const rateLimit = defineScript({
  NUMBER_OF_KEYS: 1,
  SCRIPT: rateLimitLua,
  parseCommand(parser, key: string, maxRequests: number, windowMs: number) {
    parser.pushKey(key);
    parser.push(maxRequests.toString());
    parser.push(windowMs.toString());
  },
  transformReply(reply: [number, number, number, number, number]): {
    current: number;
    limit: number;
    oldestScore: number;
    now: number;
    allowed: boolean;
  } {
    const [current, limit, oldestScore, now, allowed] = reply;
    return {
      current,
      limit,
      oldestScore,
      now,
      allowed: allowed === 1,
    };
  },
});

const redisClient = createClient({
  url: config.REDIS_URL,
  scripts: {
    rateLimit,
  },
});

redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Connected to Redis');
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    redisClient.destroy();
    console.log('Disconnected from Redis');
  }
}

export default redisClient;
