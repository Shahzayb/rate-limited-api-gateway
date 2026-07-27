import type { Request, Response, NextFunction } from 'express';

async function updateRequestWindow(apiKey: string, currentTime: number) {
  console.log(`Updating request window for API key: ${apiKey} at time: ${currentTime}`);
}

async function getRequestWindow(apiKey: string, windowStart: number) {
  console.log(`Fetching request window for API key: ${apiKey} starting from time: ${windowStart}`);
  return { numberOfRequests: 0 };
}

async function getRateLimitConfig(apiKey: string) {
  console.log(`Fetching rate limit config for API key: ${apiKey}`);
  return { limit: 100, windowMs: 60000 };
}

export async function ratelimit(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];

  if (typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key must be a string' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  const rateLimitConfig = await getRateLimitConfig(apiKey);

  const currentTime = Date.now();

  const windowStart = currentTime - rateLimitConfig.windowMs;

  const window = await getRequestWindow(apiKey, windowStart);

  if (window.numberOfRequests >= rateLimitConfig.limit) {
    const retryAfter = Math.ceil((windowStart + rateLimitConfig.windowMs - currentTime) / 1000);
    res.header('Retry-After', retryAfter.toString());
    return res.status(429).json({ error: 'Too Many Requests', retryAfter });
  }

  await updateRequestWindow(apiKey, currentTime);

  next();
}
