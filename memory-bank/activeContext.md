# Active Context: Rate-Limited API Gateway

## Current Work

- Implementing atomic Redis operations for rate limiter
- Addressing concurrency handling in `ratelimit.ts`

## Next Priorities

1. Develop Redis EVAL scripts for atomic operations
2. Implement concurrency testing with autocannon
3. Define error handling strategies for Redis failures

## Key Patterns

- TypeScript-first development
- Clean separation between middleware and Redis logic
- TDD approach for concurrency scenarios

## Recent Insights

- Current middleware structure needs atomic Redis integration
- Autocannon testing crucial for validation
