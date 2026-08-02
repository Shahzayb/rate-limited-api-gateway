/// <reference types="vitest/globals" />
import { vi, type MockedFunction } from 'vitest';
import {
  getApiKeyRecord,
  getActivePolicies,
  loadPolicyCache,
  stopPolicyCacheRefresh,
} from './policyCache.js';
import pgPool from '../db/postgres.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

// Mock PostgreSQL pool and logger
vi.mock('../db/postgres.js', () => ({
  default: {
    query: vi.fn(),
  },
}));

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('policyCache', () => {
  const mockApiKeys = [
    { api_key: 'key1', tier: 'free', label: 'Test Key 1', is_active: true },
    { api_key: 'key2', tier: 'pro', label: 'Test Key 2', is_active: true },
    { api_key: 'key3', tier: 'free', label: 'Test Key 3', is_active: false },
  ];

  const mockPolicies = [
    {
      id: 1,
      scope: 'ip',
      tier: null,
      route_pattern: '/*',
      max_requests: 10,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 2,
      scope: 'client',
      tier: 'free',
      route_pattern: '/api/*',
      max_requests: 20,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 3,
      scope: 'client',
      tier: 'pro',
      route_pattern: '/api/*',
      max_requests: 100,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 4,
      scope: 'ip',
      tier: null,
      route_pattern: '/admin/*',
      max_requests: 5,
      window_seconds: 60,
      is_active: false,
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Mock config values
    config.POLICY_CACHE_REFRESH_MS = 100; // Refresh every 100ms for testing

    // Mock pgPool.query to return our mock data
    const mockQuery = pgPool.query as MockedFunction<typeof pgPool.query>;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM api_keys')) {
        return Promise.resolve({ rows: mockApiKeys.filter((key) => key.is_active) });
      } else if (sql.includes('FROM rate_limit_policies')) {
        return Promise.resolve({ rows: mockPolicies.filter((policy) => policy.is_active) });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  afterEach(() => {
    stopPolicyCacheRefresh();
    vi.useRealTimers();
  });

  it('should load policies and API keys into cache on startup', async () => {
    await loadPolicyCache();

    expect(pgPool.query).toHaveBeenCalledWith(
      'SELECT api_key, tier, label, is_active FROM api_keys'
    );
    expect(pgPool.query).toHaveBeenCalledWith(
      'SELECT id, scope, tier, route_pattern, max_requests, window_seconds, is_active FROM rate_limit_policies WHERE is_active = TRUE'
    );

    expect(getApiKeyRecord('key1')).toEqual(mockApiKeys[0]);
    expect(getApiKeyRecord('key2')).toEqual(mockApiKeys[1]);
    expect(getApiKeyRecord('key3')).toBeUndefined();

    const activePolicies = getActivePolicies();
    expect(activePolicies.length).toBe(3); // 3 active policies
    expect(activePolicies).not.toContainEqual(mockPolicies[3]); // Inactive policy
  });

  it('should refresh the cache at the configured interval', async () => {
    await loadPolicyCache();
    expect(pgPool.query).toHaveBeenCalledTimes(2); // Initial load

    await vi.advanceTimersByTime(config.POLICY_CACHE_REFRESH_MS);
    expect(pgPool.query).toHaveBeenCalledTimes(4); // After first refresh

    await vi.advanceTimersByTime(config.POLICY_CACHE_REFRESH_MS);
    expect(pgPool.query).toHaveBeenCalledTimes(6); // After second refresh
  });

  it('should keep the last-known-good snapshot on refresh failure', async () => {
    await loadPolicyCache();
    expect(getApiKeyRecord('key1')).toEqual(mockApiKeys[0]);

    // Simulate a refresh failure
    const mockQuery = pgPool.query as MockedFunction<typeof pgPool.query>;
    mockQuery.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });

    await vi.advanceTimersByTime(config.POLICY_CACHE_REFRESH_MS);

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to refresh policy cache. Keeping last known good state.'
    );
    // Cache should still contain old data
    expect(getApiKeyRecord('key1')).toEqual(mockApiKeys[0]);
  });

  it('should stop refreshing when stopPolicyCacheRefresh is called', async () => {
    await loadPolicyCache();
    expect(pgPool.query).toHaveBeenCalledTimes(2);

    stopPolicyCacheRefresh();

    await vi.advanceTimersByTime(config.POLICY_CACHE_REFRESH_MS);
    expect(pgPool.query).toHaveBeenCalledTimes(2); // Should not have refreshed again
  });
});
