import type { RateLimitPolicy } from './policyCache.js';
import { parseRoutePattern, matchRoutePattern, compareSpecificity } from './routePattern.js';

export interface ResolvedPolicy {
  policy: RateLimitPolicy;
  params: Record<string, string>;
}

export function resolvePolicy(
  path: string,
  tier: string | undefined,
  activePolicies: RateLimitPolicy[],
  defaultPolicy: RateLimitPolicy
): ResolvedPolicy {
  let candidatePolicies: Array<{
    policy: RateLimitPolicy;
    specificity: number[];
    params: Record<string, string>;
  }> = [];

  for (const policy of activePolicies) {
    if (!policy.is_active) {
      continue;
    }

    const patternSegments = parseRoutePattern(policy.route_pattern);
    const match = matchRoutePattern(patternSegments, path);

    if (match) {
      // IP-scoped policies are always candidates
      if (policy.scope === 'ip') {
        candidatePolicies.push({ policy, specificity: match.specificity, params: match.params });
      }
      // Client-scoped policies are candidates only if a tier is provided and matches
      else if (policy.scope === 'client' && tier && policy.tier === tier) {
        candidatePolicies.push({ policy, specificity: match.specificity, params: match.params });
      }
    }
  }

  if (candidatePolicies.length === 0) {
    return { policy: defaultPolicy, params: {} };
  }

  // Sort candidates by specificity and tie-breaking rules
  candidatePolicies.sort((a, b) => {
    // 1. Specificity vector (lexicographical comparison)
    const specificityComparison = compareSpecificity(a.specificity, b.specificity);
    if (specificityComparison !== 0) {
      return -specificityComparison; // Higher specificity wins
    }

    // 2. Client scope beats IP scope (if specificity is equal)
    if (a.policy.scope === 'client' && b.policy.scope === 'ip') return -1;
    if (a.policy.scope === 'ip' && b.policy.scope === 'client') return 1;

    // 3. Lower effective rate wins (max_requests / window_seconds)
    const rateA = a.policy.max_requests / a.policy.window_seconds;
    const rateB = b.policy.max_requests / b.policy.window_seconds;
    if (rateA < rateB) return -1;
    if (rateA > rateB) return 1;

    // 4. Lowest policy ID (final deterministic fallback)
    return a.policy.id - b.policy.id;
  });

  const winningCandidate = candidatePolicies[0];
  if (!winningCandidate) {
    // This case should ideally not be reached if candidatePolicies.length > 0
    // but adding a safeguard for type safety.
    return { policy: defaultPolicy, params: {} };
  }
  return { policy: winningCandidate.policy, params: winningCandidate.params };
}
