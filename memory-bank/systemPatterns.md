# System Patterns: Rate-Limited API Gateway

## Architecture

Express.js application with Redis for rate limiting state.

```mermaid
graph TD
    A[Client] --> B(API Gateway - Express.js)
    B --> C{Rate Limiting Middleware}
    C --> D[Redis]
    D --> C
    C -- Allowed --> E[API Endpoint Logic]
    C -- Rate Limited --> F[429 Too Many Requests]
    E --> B
    F --> B
    B --> A
```

## Key Decisions

1. Fixed window algorithm (INCR + EXPIRE/TTL) for simplicity and performance
2. Redis for performance and atomic operations, leveraging Lua scripting for true atomicity
3. Lua scripting for atomicity
4. API key-based and per-endpoint limiting

## Component Relationships

- Express: Request flow orchestration
- Middleware: Rate limiting logic
- Redis: State management
- PostgreSQL: Persistent configuration storage
- k6: Ratelimiting tests
- Vitest: Unit testing

## Critical Paths

1. Atomic Redis operations
2. Configuration loading
3. Header management

## Concurrent Testing Pattern

We use k6 for concurrent request testing to validate the rate limiter:

```mermaid
sequenceDiagram
    participant k6 as k6 Test Runner
    participant Gateway as API Gateway
    participant Redis

    k6->>Gateway: Concurrent Requests (30 VUs)
    Gateway->>Redis: INCR ratelimit:key:path
    Redis-->>Gateway: Current Count
    alt Count <= Max Requests
        Gateway-->>k6: 200 OK
    else Count > Max Requests
        Gateway-->>k6: 429 Too Many Requests
    end
```

Key characteristics:

- Simulates 30 concurrent users hitting the API simultaneously
- Validates exactly 10 successful requests per window
- Ensures Redis counters increment atomically without race conditions

## Unit Testing Pattern

We use Vitest for unit testing individual components and middleware:

```mermaid
sequenceDiagram
    participant TestRunner as Vitest Test Runner
    participant Middleware as Rate Limiting Middleware
    participant Mocks as Mocked Dependencies

    TestRunner->>Middleware: Call middleware with mock req, res, next
    Middleware->>Mocks: Call mocked getRateLimitConfig
    Mocks-->>Middleware: Return mock config
    Middleware->>Mocks: Call mocked checkAndUpdateRateLimit
    Mocks-->>Middleware: Return mock rate limit status
    Middleware-->>TestRunner: Assert on res.status, res.json, res.setHeader, next
```

Key characteristics:

- Isolates the middleware logic from external dependencies.
- Uses `vi.mock` to control the behavior of `getRateLimitConfig` and `checkAndUpdateRateLimit`.
- Asserts on Express `res` object methods (`status`, `json`, `setHeader`) and `next` function calls.
