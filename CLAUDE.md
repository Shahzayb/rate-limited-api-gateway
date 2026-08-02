# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Express 5 + TypeScript (ESM, Node `nodenext`) API gateway with a Redis-backed rate limiter. Redis atomically increments/expires counters via `src/db/ratelimit.lua`, with per-path config loaded from Postgres and cached in Redis (`src/utils/rateLimitConfigLoader.ts`). Package manager is pnpm (`^11.15.0`, pinned via `devEngines`) — don't use npm/yarn.

**Gotcha:** the README and `plans/` describe this as a "sliding window" limiter. It is not — `src/db/ratelimit.lua` is a fixed-window counter (INCR/EXPIRE/TTL). Don't trust plan files' "Completed" claims as ground truth for what's actually implemented; verify against `src/`.

## Workflow (memory-bank + plans)

This project uses an AI-assisted workflow (originally set up for Cline, defined in `.clinerules/`) that Claude Code should also follow:

- **Read all of `memory-bank/`** (`projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`) at the start of a session before making changes — it's the source of truth for project context and decisions.
- **Before coding a new task**, ask whether to create a plan file at `plans/yyyy-mm-dd-<short-task-name>-plan.md` (goal, files to touch, approach, open questions) — unless the user has already said "no plan file" or "make a plan first". Don't write code until the plan file exists and is confirmed. If a plan file already exists for the current task, update it instead of creating a new one.
- **Never guess** an unstated requirement, file location, library choice, or naming convention — stop and ask.
- **After finishing a task**, update the memory bank: new dependency → `techContext.md`; new pattern/architectural decision → `systemPatterns.md`; new/changed config or env var → `techContext.md`; any of those → also note in `progress.md`; otherwise just update `activeContext.md` and `progress.md`. New plan files get referenced in the "Plan Files Reference" section of `productContext.md`.
- The user can say **"update memory bank"** to trigger a full review/update of all memory-bank files (or use `/update-memory-bank`).

## Commands

- `pnpm dev` — run with hot reload (`tsx watch`)
- `pnpm build` — `tsc && copyfiles ... dist/` — the Lua script copy step is required because `tsc` won't copy `.lua` files itself
- `pnpm test` — Vitest
- `pnpm lint` / `pnpm lint:fix` — ESLint (flat config, `typescript-eslint` recommended)
- `pnpm format` — Prettier (writes in place)
- `pnpm migrate` / `pnpm seed` — Postgres migrate/seed scripts
- `pnpm docker:up` — start full stack (Postgres + Redis + app) with hot reload; `docker:up:services` starts only Postgres/Redis
- `pnpm k6:test` — runs the k6 load test in Docker against network `rate-limited-api-gateway_default`; that network only exists once `pnpm docker:up` (or `docker:up:services`) is already running

Run `pnpm lint` and `pnpm test` before treating a change as complete.

## Code style

- Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. Imports must use explicit `.js` extensions (even though source is `.ts`), matching `module: nodenext`.
- Prettier is the formatting authority (semi, singleQuote, trailingComma es5, printWidth 100, tabWidth 2, lf) — ESLint defers to it via `eslint-config-prettier`.

## Environment

Requires `DATABASE_URL` (Postgres) and `REDIS_URL` (Redis), validated with zod in `src/config.ts`. See `.env.template` for the full list, including per-path rate limit overrides (`RATE_LIMIT_<PATH>_WINDOW` / `_MAX_REQUESTS`).
