/// <reference types="vitest/globals" />
import { resolvePolicy } from './policyResolver.js';
import type { RateLimitPolicy } from './policyCache.js';

describe('resolvePolicy', () => {
  const defaultPolicy: RateLimitPolicy = {
    id: 999,
    scope: 'ip',
    tier: null,
    route_pattern: '/*',
    max_requests: 100,
    window_seconds: 60,
    is_active: true,
  };

  const activePolicies: RateLimitPolicy[] = [
    // IP policies
    {
      id: 1,
      scope: 'ip',
      tier: null,
      route_pattern: '/*',
      max_requests: 20,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 2,
      scope: 'ip',
      tier: null,
      route_pattern: '/admin/*',
      max_requests: 5,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 3,
      scope: 'ip',
      tier: null,
      route_pattern: '/users/:id',
      max_requests: 10,
      window_seconds: 60,
      is_active: true,
    },

    // Client policies
    {
      id: 10,
      scope: 'client',
      tier: 'free',
      route_pattern: '/*',
      max_requests: 50,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 11,
      scope: 'client',
      tier: 'free',
      route_pattern: '/api/v1/*',
      max_requests: 60,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 12,
      scope: 'client',
      tier: 'free',
      route_pattern: '/admin/*',
      max_requests: 10,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 13,
      scope: 'client',
      tier: 'pro',
      route_pattern: '/*',
      max_requests: 500,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 14,
      scope: 'client',
      tier: 'pro',
      route_pattern: '/api/v1/*',
      max_requests: 600,
      window_seconds: 60,
      is_active: true,
    },
    {
      id: 15,
      scope: 'client',
      tier: 'pro',
      route_pattern: '/admin/*',
      max_requests: 30,
      window_seconds: 60,
      is_active: true,
    },

    // Inactive policy (should not be resolved)
    {
      id: 20,
      scope: 'ip',
      tier: null,
      route_pattern: '/inactive/*',
      max_requests: 1,
      window_seconds: 1,
      is_active: false,
    },
  ];

  it('should return the default policy if no policies match', () => {
    const resolved = resolvePolicy('/nonexistent', undefined, [], defaultPolicy);
    expect(resolved.policy).toEqual(defaultPolicy);
  });

  it('should resolve an IP policy for an anonymous request', () => {
    const resolved = resolvePolicy('/some/path', undefined, activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(1); // ip /*
  });

  it('should resolve a more specific IP policy for an anonymous request', () => {
    const resolved = resolvePolicy('/admin/dashboard', undefined, activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(2); // ip /admin/*
  });

  it('should resolve a client policy for an authenticated request (free tier)', () => {
    const resolved = resolvePolicy('/api/v1/users', 'free', activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(11); // client free /api/v1/*
  });

  it('should resolve a client policy for an authenticated request (pro tier)', () => {
    const resolved = resolvePolicy('/api/v1/products', 'pro', activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(14); // client pro /api/v1/*
  });

  it('should prioritize client policy over IP policy when both match and client is more specific', () => {
    // For /admin/reports, ip /admin/* (id 2) and client free /admin/* (id 12) both match.
    // Client policy (id 12) should win due to scope tie-break.
    const resolved = resolvePolicy('/admin/reports', 'free', activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(12); // client free /admin/*
  });

  it('should use IP policy if client tier has no matching pattern', () => {
    // For /users/123, client free /* (id 10) matches, but ip /users/:id (id 3) is more specific.
    // The ip /users/:id policy should win.
    const resolved = resolvePolicy('/users/123', 'free', activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(3); // ip /users/:id
    expect(resolved.params).toEqual({ id: '123' });
  });

  it('should handle specificity tie-break by effective rate (lower wins)', () => {
    const customPolicies: RateLimitPolicy[] = [
      {
        id: 1,
        scope: 'client',
        tier: 'test',
        route_pattern: '/*',
        max_requests: 10,
        window_seconds: 10,
        is_active: true,
      }, // Rate 1
      {
        id: 2,
        scope: 'client',
        tier: 'test',
        route_pattern: '/*',
        max_requests: 5,
        window_seconds: 10,
        is_active: true,
      }, // Rate 0.5 (should win)
    ];
    const resolved = resolvePolicy('/any', 'test', customPolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(2);
  });

  it('should handle specificity tie-break by lowest ID if all else is equal', () => {
    const customPolicies: RateLimitPolicy[] = [
      {
        id: 2,
        scope: 'client',
        tier: 'test',
        route_pattern: '/exact',
        max_requests: 10,
        window_seconds: 10,
        is_active: true,
      },
      {
        id: 1,
        scope: 'client',
        tier: 'test',
        route_pattern: '/exact',
        max_requests: 10,
        window_seconds: 10,
        is_active: true,
      }, // Should win
    ];
    const resolved = resolvePolicy('/exact', 'test', customPolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(1);
  });

  it('should not resolve inactive policies', () => {
    const resolved = resolvePolicy('/inactive/path', undefined, activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(1); // Should fall back to ip /*
  });

  it('should correctly extract parameters', () => {
    const resolved = resolvePolicy('/users/456', undefined, activePolicies, defaultPolicy);
    expect(resolved.policy.id).toBe(3); // ip /users/:id
    expect(resolved.params).toEqual({ id: '456' });
  });
});
