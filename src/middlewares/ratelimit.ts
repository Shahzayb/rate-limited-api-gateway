import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';
import { checkAndUpdateRateLimit } from '../utils/checkAndUpdateRatelimit.js';
import { getApiKeyRecord, getActivePolicies } from '../utils/policyCache.js';
import type { ApiKeyRecord, RateLimitPolicy } from '../utils/policyCache.js';
import { resolvePolicy } from '../utils/policyResolver.js';
import { config } from '../config.js';

export async function ratelimit(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'];
  const path = req.path;
  const ip = req.ip; // Assuming req.ip is populated by a preceding middleware like express-ip

  let apiKeyRecord: ApiKeyRecord | undefined;
  let identifier: string;
  let tier: string | undefined;

  // 1. Handle API Key presence and validity
  if (apiKeyHeader) {
    if (typeof apiKeyHeader !== 'string') {
      logger.warn({ apiKeyHeader }, 'Received non-string x-api-key header');
      return res.status(400).json({ error: 'API key must be a string' });
    }

    apiKeyRecord = getApiKeyRecord(apiKeyHeader);

    if (!apiKeyRecord) {
      logger.warn({ apiKey: apiKeyHeader }, 'Invalid API key provided');
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!apiKeyRecord.is_active) {
      logger.warn({ apiKey: apiKeyHeader }, 'Revoked API key provided');
      return res.status(401).json({ error: 'API key is revoked' });
    }

    identifier = apiKeyRecord.api_key;
    tier = apiKeyRecord.tier;
  } else {
    // Anonymous request
    identifier = ip || 'unknown_ip'; // Use IP as identifier for anonymous requests, fallback to 'unknown_ip'
    tier = undefined;
  }

  // 2. Resolve Policy
  const activePolicies = getActivePolicies();
  const defaultPolicy: RateLimitPolicy = {
    id: 0, // A dummy ID for the default policy
    scope: 'ip',
    tier: null,
    route_pattern: '/*',
    max_requests: config.RATE_LIMIT_MAX_REQUESTS,
    window_seconds: config.RATE_LIMIT_WINDOW,
    is_active: true,
  };

  const { policy } = resolvePolicy(path, tier, activePolicies, defaultPolicy);

  if (policy.id === defaultPolicy.id && activePolicies.length === 0) {
    logger.warn({ path, tier }, 'No active policies matched; using rate limit safety net');
  }

  // 3. Apply Rate Limit
  const redisKey = `rl:${policy.id}:${identifier}`;
  const { allowed, current, limit, resetSeconds } = await checkAndUpdateRateLimit(
    redisKey,
    policy.max_requests,
    policy.window_seconds
  );

  // 4. Set Rate Limit Headers
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (!allowed) {
    logger.info({ identifier, path, policyId: policy.id }, 'Rate limit exceeded');
    res.setHeader('Retry-After', resetSeconds);
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  next();
}
