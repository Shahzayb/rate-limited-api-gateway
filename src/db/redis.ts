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
  parseCommand(parser, key, oldValue, newValue) {
    parser.pushKey(key);
    parser.push(oldValue);
    parser.push(newValue);
  },
  transformReply(reply: [number, number]): [number, number] {
    return reply;
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
