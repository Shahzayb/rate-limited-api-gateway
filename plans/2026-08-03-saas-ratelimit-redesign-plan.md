# SaaS Rate Limiter Redesign: Sliding Window + IP/Tier Policy Model

## Context

The rate limiter currently has two problems:

1. **It's not actually a sliding window**, despite `plans/2026-08-02-ratelimit-improvement-plan.md` claiming this was already done. That plan file is untracked and its "Completed" claims (sliding window, k6 concurrency script, cache invalidation, pattern matching, integration tests) are fabricated — verified against the real code. `src/db/ratelimit.lua` is still a plain fixed-window counter (`INCR` + `EXPIRE`), unchanged since it was added in `f891cc3`. `CLAUDE.md` already documents this gotcha.
2. **The config model doesn't fit a SaaS gateway.** Today there is exactly one axis: an exact-match `(api_key, path)` row in Postgres, with no concept of IP-based limiting, no route patterns, and no client/subscription tier — `api_key` is a bare unvalidated string, and every new endpoint needs a manually inserted row per key. There's also no anonymous-request path at all (missing `x-api-key` → hard 400), which rules out IP-based anti-abuse limiting for unauthenticated traffic entirely.

This plan replaces both: a Redis sorted-set sliding-window log for accurate rate tracking, and a policy model where every request resolves to **exactly one winning rule**, chosen by specificity, from two rule scopes — `ip` (global anti-abuse floor) and `client` (tier + route pattern, the paid-plan limit).

### Confirmed decisions (from user)

- **Algorithm**: sliding-window *log* (Redis sorted set, not the cheaper weighted-counter approximation) — exact accounting.
- **Rule selection**: single winner per request, picked **by specificity, always**. An `ip`-scoped rule is always a candidate (authenticated or not) and acts as a permanent floor/fallback; a `client`-scoped rule (matching the caller's tier) is an additional candidate only when a valid API key is presented. Never stack — one Redis check, one set of headers.
- **Route matching**: in scope now. Policies are defined against patterns (`/api/v1/*`, `/users/:id`, `/*`), not literal paths — required for tier-based limits to scale across an API surface.
- **Client model**: a real `api_keys` table with a `tier` column is the source of truth for which tier a key belongs to.

## Database Schema

Three new migration files (the existing `migrate.ts` only runs one hardcoded file — see below):

**`src/db/migrations/2_create_api_keys_table.sql`**
```sql
CREATE TABLE api_keys (
  api_key VARCHAR(255) PRIMARY KEY,
  tier VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT api_keys_tier_not_blank CHECK (btrim(tier) <> '')
);
CREATE INDEX api_keys_tier_idx ON api_keys (tier);
```

**`src/db/migrations/3_create_rate_limit_policies_table.sql`**
```sql
CREATE TABLE rate_limit_policies (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(10) NOT NULL,
  tier VARCHAR(50),
  route_pattern VARCHAR(255) NOT NULL,
  max_requests INT NOT NULL,
  window_seconds INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rate_limit_policies_scope_check CHECK (scope IN ('ip', 'client')),
  CONSTRAINT rate_limit_policies_scope_tier_check CHECK (
    (scope = 'ip' AND tier IS NULL) OR
    (scope = 'client' AND tier IS NOT NULL AND btrim(tier) <> '')
  ),
  CONSTRAINT rate_limit_policies_max_requests_check CHECK (max_requests >= 0),
  CONSTRAINT rate_limit_policies_window_seconds_check CHECK (window_seconds > 0)
);
-- Postgres treats every NULL as distinct, so a plain UNIQUE(scope, tier, route_pattern)
-- would not stop duplicate 'ip' rows (both have tier NULL) — coalesce first.
CREATE UNIQUE INDEX rate_limit_policies_identity_idx
  ON rate_limit_policies (scope, COALESCE(tier, ''), route_pattern);
CREATE INDEX rate_limit_policies_active_idx ON rate_limit_policies (is_active);
```

**`src/db/migrations/4_drop_rate_limit_config_table.sql`** — `DROP TABLE IF EXISTS rate_limit_config;` (greenfield project, no data to migrate).

`id` is `SERIAL` (integer), not UUID — deliberately, to keep Redis keys short (see below).

**`src/db/migrate.ts` needs to become a real (minimal) runner**, since it currently hardcodes exactly one file and re-running it would error on `CREATE TABLE` without `IF NOT EXISTS`:
- `CREATE TABLE IF NOT EXISTS schema_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())` at the start of every run.
- Read `src/db/migrations/*.sql`, sort numerically by leading `N_` prefix (not lexicographically), diff against `schema_migrations`, and run each unapplied file inside its own `BEGIN`/`COMMIT` (rollback + abort the whole run on failure).

## Route Pattern Matching & Specificity

New pure module `src/utils/routePattern.ts`. Recommend **hand-rolled matching, not `path-to-regexp`** (Express depends on it transitively but it's not a direct dependency): its v8 syntax needs named wildcards (`*splat`) and reserves `()[]?+!`, so it can't accept the `/api/v1/*` syntax directly and would need a rewrite layer anyway; it also has no built-in specificity ranking, which has to be hand-written regardless. A 3-kind vocabulary (static / `:param` / trailing `*`) is small enough to hand-roll and exhaustively unit test.

**Matching**: split pattern and path into `/`-segments. A `*` must be the final segment and matches the rest of the path. A `:name` segment matches exactly one path segment. Otherwise segments must match literally. No wildcard consumed ⇒ segment counts must match exactly.

**Specificity**: score each pattern as a per-segment weight vector (`static=2, param=1, wildcard=0`), compare vectors **lexicographically left-to-right** rather than summing. This encodes "a static match earlier in the path always beats a param match at that position" and naturally handles variable-length wildcard patterns without a separate length tie-break (a wildcard can only be last, so any longer-still-matching pattern at that position must have a nonzero segment there and wins automatically).

**Tie-break chain** (for genuine ties in pattern shape):
1. Specificity vector (above) — resolves almost everything.
2. **`client` scope beats `ip` scope** — a valid tier credential is a more specific match than "any caller by IP" at equal pattern shape. This is a refinement of the original "more restrictive wins" idea: applying restrictiveness first would let an `ip` floor override an authenticated tier grant whenever the IP rule happens to be stricter, which contradicts "IP is a floor, not a ceiling."
3. **Lower effective rate wins** (`max_requests / window_seconds`) — only reached for same-scope ties (e.g. duplicate/overlapping config rows), a safety-conservative default for what's essentially a config mistake.
4. **Lowest policy `id`** — final deterministic fallback, never nondeterministic.

Malformed patterns (`*` not in final position) are rejected at cache-load time with a logged warning, not a request-time 500.

## Sliding Window Lua Script

Full rewrite of `src/db/ratelimit.lua` as a sorted-set log:

```lua
-- KEYS[1] = rl:{policyId}:{identifier}
-- ARGV[1] = max_requests, ARGV[2] = window_ms
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

local t = redis.call('TIME')
local now_ms = math.floor(tonumber(t[1]) * 1000 + tonumber(t[2]) / 1000)
local window_start = now_ms - window_ms

redis.call('ZREMRANGEBYSCORE', key, '-inf', '(' .. window_start)
local current = redis.call('ZCARD', key)
local allowed = current < max_requests

if allowed then
  -- Unique member without a second counter key: NX-add, bump suffix on collision.
  local suffix = 0
  while redis.call('ZADD', key, 'NX', now_ms, now_ms .. '-' .. suffix) == 0 do
    suffix = suffix + 1
  end
  current = current + 1
end

redis.call('PEXPIRE', key, window_ms + 1000)

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldest_score = now_ms
if #oldest > 0 then oldest_score = tonumber(oldest[2]) end

return { current, max_requests, oldest_score, now_ms, allowed and 1 or 0 }
```

Key points:
- **Race-free "now"** comes from Redis `TIME` inside the script, never a client timestamp — preserves the original atomicity intent from `f891cc3`.
- **Denied (429) requests do not consume a slot** — only admitted requests get `ZADD`ed. This is the standard behavior for a sliding-window *log* (the set represents admission history); it doesn't let a blocked client "reset" anything since evicted/counted entries are unaffected either way.
- `PEXPIRE` runs unconditionally so abandoned keys self-clean even on a denied call.
- Return tuple gives the caller enough to compute both `remaining = max(0, max_requests - current)` and `resetSeconds = ceil(max(0, oldest_score + window_ms - now_ms) / 1000)` without a second round trip.

`src/db/redis.ts`: update `defineScript`'s `parseCommand` to push `(max_requests, window_ms)` and `transformReply` to the 5-tuple type above.

`src/utils/checkAndUpdateRatelimit.ts`: new return shape `{ allowed, current, limit, resetSeconds }`; converts `windowSeconds → windowMs` before calling the script.

## Request Resolution Flow

New modules, both pure/synchronous where possible so the hot path avoids extra I/O:

- **`src/utils/policyCache.ts`** — loads all of `api_keys` + active `rate_limit_policies` into memory at startup (`loadPolicyCache()`, called in `index.ts`'s `startServer()` after `connectPostgres()`, before `app.listen()`), refreshed on a `setInterval` (new env var `POLICY_CACHE_REFRESH_MS`, default 30000). On a refresh failure, log and **keep the last-known-good snapshot** rather than blanking it. `stopPolicyCacheRefresh()` called from `shutdown()`. Exposes `getApiKeyRecord(key)` and `getActivePolicies()`.
- **`src/utils/policyResolver.ts`** — pure `resolvePolicy(path, tier)`: filters `getActivePolicies()` to those matching the path (via `routePattern.ts`) and scope (`ip` always eligible; `client` only if `tier` matches), then picks the winner via the specificity/tie-break chain above.

Per-request flow in `src/middlewares/ratelimit.ts`:
1. Read `x-api-key`, `req.path`, `req.ip`.
2. Header present but not a single string (duplicate headers) → `400`.
3. Header present and a string → look up `policyCache.getApiKeyRecord(apiKey)`:
   - Not found → **`401` `Invalid API key`**.
   - Found but `is_active = false` → **`401` `API key is revoked`**.
   - Found and active → `tier = record.tier`, `identifier = apiKey`.
   - Invalid/revoked keys are rejected outright, not silently downgraded to anonymous/IP limiting — consistent with how real gateways (Kong, AWS API Gateway, Stripe) treat bad credentials, and avoids masking client misconfiguration.
4. No header at all → legitimate anonymous path: `tier = undefined`, `identifier = req.ip`.
5. `policy = resolvePolicy(req.path, tier)`. If no candidate matches at all (config gap), fall back to a safety-net default (`RATE_LIMIT_MAX_REQUESTS`/`RATE_LIMIT_WINDOW`, repurposed from "global per-path default" to "no-policy-matched safety net") and log a warning.
6. Redis key: **`rl:${policy.id}:${identifier}`** — keyed by policy id (not raw pattern text or literal path), which is why `id` is a compact `SERIAL`. This is stable across pattern-text edits and means all literal paths matching one winning pattern for one identifier share a single counter — the intended effect of moving from per-exact-path to per-pattern policies.
7. Call `checkAndUpdateRateLimit`, set headers, `429` + `Retry-After` if denied, else `next()`.

## Response Contract Changes

- `X-RateLimit-Limit` / `X-RateLimit-Remaining` — same names, now reflect the winning policy.
- `X-RateLimit-Reset` — **new**, set on every response (not just 429), exact seconds until the oldest window entry ages out (the sliding-window log gives this precisely, unlike the old fixed-window TTL).
- `Retry-After` — unchanged, 429-only, same value as `X-RateLimit-Reset` at that moment.
- `400` — narrowed to only "non-string api key header" (missing key is no longer an error).
- `401` — new, invalid or revoked API key.
- `429` / `500` — unchanged shape.

## File-by-File Changes

**New**: `src/db/migrations/{2,3,4}_*.sql`, `src/utils/routePattern.ts`, `src/utils/policyCache.ts`, `src/utils/policyResolver.ts`, plus unit tests `routePattern.test.ts`, `policyResolver.test.ts`, `policyCache.test.ts`.

**Deleted**: `src/utils/rateLimitConfigLoader.ts` — replaced wholesale (pattern matching + specificity ranking is a fundamentally different shape of logic than point lookups), not incrementally modified.

**Rewritten**: `src/db/ratelimit.lua`, `src/db/redis.ts`, `src/utils/checkAndUpdateRatelimit.ts`, `src/middlewares/ratelimit.ts`, `src/middlewares/ratelimit.test.ts`, `src/db/migrate.ts`, `src/db/seed.ts`, `src/index.ts` (wire up policy cache load/refresh/shutdown), `src/config.ts` (add `POLICY_CACHE_REFRESH_MS`; remove `CACHE_TTL` and `getEnvRateLimitConfig`/per-path env vars — patterns are DB-owned now, and a parallel env-var scheme can't express `/api/v1/*` and would just create two conflicting config sources), `.env.template`.

**`src/middlewares/ratelimit.test.ts`** — mocks shift to `policyCache`/`policyResolver`/`checkAndUpdateRateLimit`. New cases: anonymous request hits ip policy; unknown key → 401; revoked key → 401; non-string key → 400 (kept); tier policy outranks ip policy; tier key with no matching tier pattern falls through to ip; specificity tie resolved by scope tie-break; multi-candidate pattern matching; 429 includes `Retry-After` + `X-RateLimit-Reset`; allowed response also includes `X-RateLimit-Reset`; no-match safety-net fallback + warning log.

## Seed Data (`src/db/seed.ts`)

```sql
INSERT INTO api_keys (api_key, tier, label, is_active) VALUES
  ('free_test_key',    'free', 'Seed: free tier test key',         TRUE),
  ('pro_test_key',     'pro',  'Seed: pro tier test key',          TRUE),
  ('revoked_test_key', 'free', 'Seed: revoked key, exercises 401', FALSE)
ON CONFLICT (api_key) DO UPDATE SET tier = EXCLUDED.tier, is_active = EXCLUDED.is_active, updated_at = NOW();

INSERT INTO rate_limit_policies (scope, tier, route_pattern, max_requests, window_seconds) VALUES
  ('ip',     NULL,   '/*',         20,  60),  -- universal anonymous/IP floor
  ('ip',     NULL,   '/admin/*',    5,  60),  -- stricter IP floor on a sensitive route
  ('client', 'free', '/api/v1/*',  60,  60),
  ('client', 'pro',  '/api/v1/*', 600,  60),
  ('client', 'free', '/admin/*',   10,  60),
  ('client', 'pro',  '/admin/*',   30,  60)
ON CONFLICT (scope, COALESCE(tier, ''), route_pattern) DO UPDATE SET
  max_requests = EXCLUDED.max_requests, window_seconds = EXCLUDED.window_seconds, updated_at = NOW();
```

This exercises the interesting paths for manual testing: anonymous `/admin/x` → floor of 5; `free_test_key` on `/admin/x` → ip(5) vs client-free(10) tie in shape → scope tie-break → 10; `pro_test_key` on `/admin/x` → 30; `pro_test_key` on `/api/v1/x` → client-pro(600) strictly outranks ip `/*`(20), no tie-break needed; `revoked_test_key` on anything → 401.

## Out of Scope (explicit follow-ups, not part of this change)

- Active cache invalidation (PG NOTIFY / Redis pub-sub) — the in-memory policy cache with interval refresh is the accepted tradeoff for now.
- Real credential hashing for `api_keys.api_key` (currently bare, like today).
- Formalizing `tier` as its own referenced entity/table.
- k6 concurrency script updates.
- Deleting the stale `plans/2026-08-02-ratelimit-improvement-plan.md`.

## Verification

1. `pnpm lint` and `pnpm test` (unit tests, including new `routePattern`/`policyResolver`/`policyCache` tests and the rewritten `ratelimit.test.ts`).
2. `pnpm docker:up:services` (Postgres + Redis), `pnpm migrate` (confirm it runs all 4 files in order and is idempotent on a second run), `pnpm seed`.
3. `pnpm dev`, then manually exercise the seeded scenarios with `curl`:
   - No `x-api-key` against `/admin/...` repeatedly → 429 after 5 within 60s, headers show `X-RateLimit-Limit: 5`.
   - `free_test_key` against `/admin/...` → limit 10 (tier beats ip floor at equal specificity).
   - `pro_test_key` against `/api/v1/...` → limit 600 (tier strictly more specific than ip `/*`).
   - `revoked_test_key` against anything → 401.
   - Unknown key → 401.
   - Confirm sliding behavior directly: send `max_requests` requests, wait less than the full window, send one more — should still be limited (unlike a fixed window, which would fully reset at the window boundary); wait past the oldest entry's age-out and confirm exactly one slot frees up.
4. Confirm `X-RateLimit-Reset` is present and shrinks sensibly across successive requests within a window.
