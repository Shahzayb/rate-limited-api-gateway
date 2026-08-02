import pgPool from '../db/postgres.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { parseRoutePattern } from './routePattern.js';

export interface ApiKeyRecord {
  api_key: string;
  tier: string;
  label: string;
  is_active: boolean;
}

export interface RateLimitPolicy {
  id: number;
  scope: 'ip' | 'client';
  tier: string | null;
  route_pattern: string;
  max_requests: number;
  window_seconds: number;
  is_active: boolean;
}

let apiKeysCache: Map<string, ApiKeyRecord> = new Map();
let policiesCache: RateLimitPolicy[] = [];
let refreshInterval: NodeJS.Timeout | null = null;

export function getApiKeyRecord(apiKey: string): ApiKeyRecord | undefined {
  return apiKeysCache.get(apiKey);
}

export function getActivePolicies(): RateLimitPolicy[] {
  return policiesCache.filter((policy) => policy.is_active);
}

async function fetchAndCachePolicies() {
  try {
    const { rows: apiKeys } = await pgPool.query<ApiKeyRecord>(
      'SELECT api_key, tier, label, is_active FROM api_keys'
    );
    const newApiKeysCache = new Map<string, ApiKeyRecord>();
    apiKeys.forEach((key) => newApiKeysCache.set(key.api_key, key));
    apiKeysCache = newApiKeysCache;

    const { rows: policies } = await pgPool.query<RateLimitPolicy>(
      'SELECT id, scope, tier, route_pattern, max_requests, window_seconds, is_active FROM rate_limit_policies WHERE is_active = TRUE'
    );

    const validPolicies: RateLimitPolicy[] = [];
    for (const policy of policies) {
      try {
        parseRoutePattern(policy.route_pattern);
        validPolicies.push(policy);
      } catch (error) {
        logger.warn({ error, policy }, 'Skipping malformed rate limit policy pattern');
      }
    }

    policiesCache = validPolicies;

    logger.info('Policy cache refreshed successfully.');
  } catch (error) {
    logger.error(error, 'Failed to refresh policy cache. Keeping last known good state.');
  }
}

export async function loadPolicyCache() {
  await fetchAndCachePolicies(); // Initial load
  refreshInterval = setInterval(fetchAndCachePolicies, config.POLICY_CACHE_REFRESH_MS);
  logger.info(`Policy cache refresh scheduled every ${config.POLICY_CACHE_REFRESH_MS}ms.`);
}

export function stopPolicyCacheRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    logger.info('Policy cache refresh stopped.');
  }
}
