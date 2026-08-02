/// <reference types="vitest/globals" />
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { ratelimit } from './ratelimit.js';
import type { Request, Response, NextFunction } from 'express';
import { getApiKeyRecord, getActivePolicies } from '../utils/policyCache.js';
import { resolvePolicy } from '../utils/policyResolver.js';
import { checkAndUpdateRateLimit } from '../utils/checkAndUpdateRatelimit.js';
import { config } from '../config.js';
import type { RateLimitPolicy, ApiKeyRecord } from '../utils/policyCache.js';

// Mock dependencies
vi.mock('../utils/policyCache.js', () => ({
  getApiKeyRecord: vi.fn(),
  getActivePolicies: vi.fn(),
}));
vi.mock('../utils/policyResolver.js', () => ({
  resolvePolicy: vi.fn(),
}));
vi.mock('../utils/checkAndUpdateRatelimit.js', () => ({
  checkAndUpdateRateLimit: vi.fn(),
}));
vi.mock('../config.js', () => ({
  config: {
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 60,
  },
}));

describe('ratelimit middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockDefaultPolicy: RateLimitPolicy = {
    id: 0,
    scope: 'ip',
    tier: null,
    route_pattern: '/*',
    max_requests: config.RATE_LIMIT_MAX_REQUESTS,
    window_seconds: config.RATE_LIMIT_WINDOW,
    is_active: true,
  };

  const mockIpPolicy: RateLimitPolicy = {
    id: 1,
    scope: 'ip',
    tier: null,
    route_pattern: '/*',
    max_requests: 20,
    window_seconds: 60,
    is_active: true,
  };

  const mockAdminIpPolicy: RateLimitPolicy = {
    id: 2,
    scope: 'ip',
    tier: null,
    route_pattern: '/admin/*',
    max_requests: 5,
    window_seconds: 60,
    is_active: true,
  };

  const mockFreeClientPolicy: RateLimitPolicy = {
    id: 10,
    scope: 'client',
    tier: 'free',
    route_pattern: '/api/v1/*',
    max_requests: 60,
    window_seconds: 60,
    is_active: true,
  };

  const mockProClientPolicy: RateLimitPolicy = {
    id: 11,
    scope: 'client',
    tier: 'pro',
    route_pattern: '/api/v1/*',
    max_requests: 600,
    window_seconds: 60,
    is_active: true,
  };

  beforeEach(() => {
    req = { headers: {}, ip: '127.0.0.1' }; // Initialize req without path
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(getApiKeyRecord).mockReturnValue(undefined);
    vi.mocked(getActivePolicies).mockReturnValue([
      mockIpPolicy,
      mockAdminIpPolicy,
      mockFreeClientPolicy,
      mockProClientPolicy,
    ]);
    // resolvePolicy mock will be set per test case where specific policy resolution is needed
    // checkAndUpdateRateLimit mock will be set per test case where specific policy resolution is needed
  });

  // Helper to create a request object with a specific path
  const createRequest = (path: string, headers?: Record<string, string>): Request =>
    ({
      ...(req as Request),
      path,
      headers: { ...req.headers, ...headers },
      ip: req.ip, // Ensure ip is always present
    }) as Request;

  test('rejects non-string x-api-key header', async () => {
    const testReq = createRequest('/test', { 'x-api-key': ['key1', 'key2'] as any });
    await ratelimit(testReq, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key must be a string' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid API key', async () => {
    const testReq = createRequest('/test', { 'x-api-key': 'invalid-key' });
    vi.mocked(getApiKeyRecord).mockReturnValue(undefined);
    await ratelimit(testReq, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects revoked API key', async () => {
    const testReq = createRequest('/test', { 'x-api-key': 'revoked-key' });
    vi.mocked(getApiKeyRecord).mockReturnValue({
      api_key: 'revoked-key',
      tier: 'free',
      label: 'Revoked Key',
      is_active: false,
    });
    await ratelimit(testReq, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key is revoked' });
    expect(next).not.toHaveBeenCalled();
  });

  test('allows anonymous request and applies IP policy', async () => {
    const testReq = createRequest('/some/path');
    vi.mocked(resolvePolicy).mockReturnValue({ policy: mockIpPolicy, params: {} });
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: mockIpPolicy.max_requests,
      resetSeconds: 59,
    });
    await ratelimit(testReq, res as Response, next);
    expect(vi.mocked(resolvePolicy)).toHaveBeenCalledWith(
      '/some/path',
      undefined,
      expect.any(Array),
      expect.any(Object)
    );
    expect(vi.mocked(checkAndUpdateRateLimit)).toHaveBeenCalledWith(
      'rl:1:127.0.0.1',
      mockIpPolicy.max_requests,
      mockIpPolicy.window_seconds
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', mockIpPolicy.max_requests);
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      mockIpPolicy.max_requests - 1
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 59);
    expect(next).toHaveBeenCalled();
  });

  test('applies client policy for authenticated request', async () => {
    const testReq = createRequest('/api/v1/data', { 'x-api-key': 'free-key' });
    vi.mocked(getApiKeyRecord).mockReturnValue({
      api_key: 'free-key',
      tier: 'free',
      label: 'Free Key',
      is_active: true,
    });
    vi.mocked(resolvePolicy).mockReturnValue({ policy: mockFreeClientPolicy, params: {} });
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: mockFreeClientPolicy.max_requests,
      resetSeconds: 59,
    });
    await ratelimit(testReq, res as Response, next);
    expect(vi.mocked(resolvePolicy)).toHaveBeenCalledWith(
      '/api/v1/data',
      'free',
      expect.any(Array),
      expect.any(Object)
    );
    expect(vi.mocked(checkAndUpdateRateLimit)).toHaveBeenCalledWith(
      'rl:10:free-key',
      mockFreeClientPolicy.max_requests,
      mockFreeClientPolicy.window_seconds
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Limit',
      mockFreeClientPolicy.max_requests
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      mockFreeClientPolicy.max_requests - 1
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 59);
    expect(next).toHaveBeenCalled();
  });

  test('returns 429 when rate limit exceeded', async () => {
    const testReq = createRequest('/api/v1/data', { 'x-api-key': 'free-key' });
    vi.mocked(getApiKeyRecord).mockReturnValue({
      api_key: 'free-key',
      tier: 'free',
      label: 'Free Key',
      is_active: true,
    });
    vi.mocked(resolvePolicy).mockReturnValue({ policy: mockFreeClientPolicy, params: {} });
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      allowed: false,
      current: 61,
      limit: 60,
      resetSeconds: 10,
    });

    await ratelimit(testReq, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 10);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 10);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too Many Requests' });
    expect(next).not.toHaveBeenCalled();
  });

  test('falls back to default policy if no active policies match', async () => {
    const testReq = createRequest('/unknown/route');
    vi.mocked(getActivePolicies).mockReturnValue([]); // No active policies
    vi.mocked(resolvePolicy).mockReturnValue({ policy: mockDefaultPolicy, params: {} });
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: config.RATE_LIMIT_MAX_REQUESTS,
      resetSeconds: 59,
    });

    await ratelimit(testReq, res as Response, next);
    expect(vi.mocked(resolvePolicy)).toHaveBeenCalledWith(
      '/unknown/route',
      undefined,
      [],
      mockDefaultPolicy
    );
    expect(vi.mocked(checkAndUpdateRateLimit)).toHaveBeenCalledWith(
      `rl:0:${testReq.ip}`,
      config.RATE_LIMIT_MAX_REQUESTS,
      config.RATE_LIMIT_WINDOW
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', config.RATE_LIMIT_MAX_REQUESTS);
    expect(next).toHaveBeenCalled();
  });

  test('uses more specific IP policy for anonymous admin route', async () => {
    const testReq = createRequest('/admin/dashboard');
    vi.mocked(resolvePolicy).mockReturnValue({ policy: mockAdminIpPolicy, params: {} });
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: mockAdminIpPolicy.max_requests,
      resetSeconds: 59,
    });
    await ratelimit(testReq, res as Response, next);
    expect(vi.mocked(resolvePolicy)).toHaveBeenCalledWith(
      '/admin/dashboard',
      undefined,
      expect.any(Array),
      expect.any(Object)
    );
    expect(vi.mocked(checkAndUpdateRateLimit)).toHaveBeenCalledWith(
      'rl:2:127.0.0.1',
      mockAdminIpPolicy.max_requests,
      mockAdminIpPolicy.window_seconds
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', mockAdminIpPolicy.max_requests);
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      mockAdminIpPolicy.max_requests - 1
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 59);
    expect(next).toHaveBeenCalled();
  });

  test('uses client policy over IP policy when client is more specific', async () => {
    const testReq = createRequest('/admin/reports', { 'x-api-key': 'free-key' });
    vi.mocked(getApiKeyRecord).mockReturnValue({
      api_key: 'free-key',
      tier: 'free',
      label: 'Free Key',
      is_active: true,
    });
    // Assume resolvePolicy would pick a client policy with id 12 (from plan)
    const mockSpecificClientPolicy: RateLimitPolicy = {
      id: 12,
      scope: 'client',
      tier: 'free',
      route_pattern: '/admin/*',
      max_requests: 10,
      window_seconds: 60,
      is_active: true,
    };
    vi.mocked(resolvePolicy).mockReturnValue({ policy: mockSpecificClientPolicy, params: {} });
    vi.mocked(checkAndUpdateRateLimit).mockResolvedValue({
      allowed: true,
      current: 1,
      limit: mockSpecificClientPolicy.max_requests,
      resetSeconds: 59,
    });
    await ratelimit(testReq, res as Response, next);
    expect(vi.mocked(resolvePolicy)).toHaveBeenCalledWith(
      '/admin/reports',
      'free',
      expect.any(Array),
      expect.any(Object)
    );
    expect(vi.mocked(checkAndUpdateRateLimit)).toHaveBeenCalledWith(
      'rl:12:free-key',
      mockSpecificClientPolicy.max_requests,
      mockSpecificClientPolicy.window_seconds
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Limit',
      mockSpecificClientPolicy.max_requests
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      mockSpecificClientPolicy.max_requests - 1
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', 59);
    expect(next).toHaveBeenCalled();
  });
});
