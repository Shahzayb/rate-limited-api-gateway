# Rate-Limited API Gateway [![Built with AI](https://img.shields.io/badge/Built%20with-AI-%2300C4CC?style=flat-square)](<>)

Redis-backed sliding window rate limiter built using AI-assisted development. Features:

- **Atomic Lua operations** (prevents race conditions)
- Configurable limits
- Redis persistence
- Express middleware

**Memory Bank** (`/memory-bank/`) contains:

- Project requirements
- Architectural decisions
- Progress tracking
- Technical context

**AI-Assisted Development**: This project was built using an AI workflow with:

- Memory Bank for context tracking
- Plan files for implementation blueprints
- [Learn more about our AI workflow](/memory-bank/)

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
