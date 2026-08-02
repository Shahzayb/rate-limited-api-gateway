# Rate-Limited API Gateway

Redis-backed fixed-window rate limiter.

Features:

- Atomic Lua operations (prevents race conditions)
- Configurable limits
- Redis persistence
- Express middleware

**Memory Bank** (`/memory-bank/`) contains:

- Project requirements
- Architectural decisions
- Progress tracking
- Technical context

**Workflow**: AI-assisted development using:

- Memory Bank docs
- Plan files (see `agents.md`)

## Setup

```bash
# Development
pnpm docker:up

pnpm docker:migrate

pnpm docker:seed
```

## Test

```bash
pnpm test
pnpm k6:test
```

## Usage

```typescript
app.use(ratelimit);
```
