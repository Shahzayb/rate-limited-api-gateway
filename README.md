# Rate-Limited API Gateway

Redis-backed sliding window rate limiter. Features:

- Atomic Lua operations
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

# Production build
pnpm docker:up:prod
```

## Usage

```typescript
app.use(ratelimit);
```
