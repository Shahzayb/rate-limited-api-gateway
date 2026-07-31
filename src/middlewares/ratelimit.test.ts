import { describe, expect, test, vi, beforeEach } from 'vitest';
import { ratelimit } from './ratelimit.js';
import type { Request, Response, NextFunction } from 'express';
import { getRateLimitConfig } from '../utils/rateLimitConfigLoader.js';
import { checkAndUpdateRateLimit } from '../utils/checkAndUpdateRatelimit.js';

// Mock dependencies
vi.mock('../utils/rateLimitConfigLoader.js', () => ({
  getRateLimitConfig: vi.fn(),
}));

vi.mock('../utils/checkAndUpdateRatelimit.js', () => ({
  checkAndUpdateRateLimit: vi.fn(),
}));

describe('ratelimit middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, path: '/test' };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(getRateLimitConfig).mockResolvedValue({
      maxRequests: 10,
      windowSeconds: 60,
    });

    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      currentRequests: 1,
      ttl: 59,
    });
  });

  test('rejects missing API key', async () => {
    await ratelimit(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key is required' });
  });

  test('rejects non-string API key', async () => {
    req.headers = { 'x-api-key': 123 as any };
    await ratelimit(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key must be a string' });
  });

  test('handles config loading error', async () => {
    vi.mocked(getRateLimitConfig).mockRejectedValue(new Error('DB error'));
    req.headers = { 'x-api-key': 'valid-key' };

    await ratelimit(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });

  test('sets correct headers when under limit', async () => {
    req.headers = { 'x-api-key': 'valid-key' };
    await ratelimit(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    expect(next).toHaveBeenCalled();
  });

  test('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      currentRequests: 11,
      ttl: 30,
    });
    req.headers = { 'x-api-key': 'valid-key' };

    await ratelimit(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 30);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too Many Requests' });
  });
});
