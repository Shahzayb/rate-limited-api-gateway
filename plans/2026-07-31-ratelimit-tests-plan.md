# Plan for Rate Limit Middleware Tests

## Goal

To write comprehensive unit tests for the `src/middlewares/ratelimit.ts` middleware using Vitest.

## Files to be Touched

- `src/middlewares/ratelimit.test.ts` (new file)
- `package.json` (update scripts)
- `memory-bank/techContext.md`
- `memory-bank/progress.md`
- `memory-bank/systemPatterns.md`
- `README.md` (if necessary)

## Approach

1.  **Create Test File**: Create `src/middlewares/ratelimit.test.ts`.
2.  **Implement Test Cases**:
    - Test for missing `x-api-key` header.
    - Test for non-string `x-api-key` header.
    - Test error handling during `getRateLimitConfig` (e.g., database errors).
    - Test successful rate limiting:
      - When requests are within the limit.
      - When requests exceed the limit (expect 429 Too Many Requests).
    - Verify `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers are set correctly.
    - Ensure `next()` is called when the limit is not exceeded.
3.  **Mock Dependencies**: Use `vi.mock` to mock `getRateLimitConfig` and `checkAndUpdateRateLimit` to control their behavior during tests.
4.  **Update `package.json`**: Add a `test` script to run Vitest.
5.  **Update Memory Bank**: Document the testing strategy and progress in `techContext.md`, `progress.md`, and `systemPatterns.md`.
6.  **Review `README.md`**: Check if any updates are needed regarding testing instructions.

## Open Questions

- None, the plan is clear.
