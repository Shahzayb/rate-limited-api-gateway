# Plan: Implement Naive Rate Limit

## Goal

Implement the naive version of the rate limit middleware in `src/middlewares/ratelimit.ts`. This implementation will not handle race conditions and will serve as a baseline before implementing the atomic sliding window algorithm.

## Files to be touched

- `plans/2026-07-28-naive-ratelimit-plan.md` (create)
- `src/middlewares/ratelimit.ts` (modify)
- `memory-bank/activeContext.md` (update)
- `memory-bank/progress.md` (update)

## Approach

1.  **Database Schema**:
    - Create migration file for `rate_limit_config` table
    - Columns: api_key, path, max_requests, window_seconds, created_at, updated_at

2.  **Configuration System**:
    - Create Zod schema for configuration
    - Implement `getRateLimitConfig(apiKey: string, path: string)` that:
      - Checks Redis cache first (`config:${apiKey}:${path}`)
      - On cache miss, queries PostgreSQL
      - Falls back to environment variables
      - Caches results in Redis with TTL (default 300s)

3.  **Seed Data**:
    - Create seed script with test configurations:
      ```sql
      INSERT INTO rate_limit_config (api_key, path, max_requests, window_seconds) VALUES
      ('test_key', '/api/v1', 10, 60),
      ('test_key', '/admin', 2, 30);
      ```

4.  **Redis Operations**:
    - `getRequestWindow(apiKey: string, path: string)`:
      - Construct Redis key: `ratelimit:${apiKey}:${path}`
      - Use `GET` to retrieve current count
    - `updateRequestWindow(apiKey: string, path: string)`:
      - Use `INCR` to increment count
      - Use `EXPIRE` to set TTL (window duration)

5.  **Middleware Flow**:
    - Extract `x-api-key` header and request path
    - Retrieve configuration via `getRateLimitConfig`
    - Check current count against retrieved limits
    - Return 429 with `Retry-After` header when limit exceeded
    - Include `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers

6.  **Error Handling**:
    - Handle missing API key (400 Bad Request)
    - Handle Redis connection errors (503 Service Unavailable)

## Resolved Decisions

1. **Configuration Caching**:
   - Implement Redis caching with 300-second TTL
   - Cache key format: `config:${apiKey}:${path}`
   - Cache invalidation: Automatic TTL expiration

2. **Default Rate Limits**:
   - `RATE_LIMIT_WINDOW=10` (seconds)
   - `RATE_LIMIT_MAX_REQUESTS=5`

3. **Environment Variable Structure**:

   ```env
   # Default configuration
   RATE_LIMIT_WINDOW=10
   RATE_LIMIT_MAX_REQUESTS=5

   # Per-endpoint overrides (optional)
   RATE_LIMIT_v1users_WINDOW=5
   RATE_LIMIT_v1users_MAX_REQUESTS=2
   ```

4. **Implementation Sequence**:
   1. Create database migration
   2. Add seed data script
   3. Create Zod schema for configuration
   4. Implement configuration loader with Redis caching
   5. Build Redis operations for rate counting
   6. Integrate middleware flow
   7. Add error handling
