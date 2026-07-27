# Integration Plan: Redis and PostgreSQL Services (Revised)

## Goal

Establish Redis and PostgreSQL connections without modifying middleware logic. Focus on:

1. Environment configuration
2. Service initialization
3. Connection pooling for PostgreSQL

## Files to be Touched

- `.env.development` (new) - Development environment variables
- `.env.production` (new) - Production environment variables
- `src/config.ts` (new) - Configuration loader
- `src/db/redis.ts` (new) - Redis connection utility
- `src/db/postgres.ts` (new) - PostgreSQL connection utility (with pooling)
- `src/index.ts` (modify) - Initialize services

## Approach

### 1. Environment Configuration

- Create `.env.development` with local credentials:
  ```
  REDIS_URL=redis://localhost:6379
  PG_URL=postgres://user:pass@localhost:5432/ratelimit
  ```
- Create `.env.production` with production credentials (to be provided)

### 2. Dotenv Installation

- Install dotenv package: `pnpm add dotenv`
- Install TypeScript types: `pnpm add -D @types/dotenv`

### 3. Configuration Loader

- Create `src/config.ts` to:
  - Use dotenv to load environment variables
  - Validate required variables with Zod
  - Export configuration object

### 3. Connection Utilities

- Create `src/db/redis.ts`:
  - Connect using `node-redis`
  - Export Redis client with error handling
- Create `src/db/postgres.ts`:
  - Use `pg.Pool` for connection pooling
  - Export PostgreSQL pool instance

### 4. Service Initialization

- Modify `src/index.ts`:
  - Import Redis client and PostgreSQL pool
  - Initialize connections on startup
  - Add graceful shutdown handlers
  - Verify connections before starting server

## Implementation Notes

- Middleware (`ratelimit.ts`) remains unchanged
- Redis/PG connections will be available for future use
- PostgreSQL pooling configured with default settings
- Dotenv will be used for environment variable loading instead of Node.js native --env-file
