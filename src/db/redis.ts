import { createClient } from 'redis';
import { config } from '../config.js';

const redisClient = createClient({
  url: config.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Connected to Redis');
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.disconnect();
    console.log('Disconnected from Redis');
  }
}

export default redisClient;
