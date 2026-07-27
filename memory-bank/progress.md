# Progress: Rate-Limited API Gateway

## What Works

- **Project Structure**: The basic Express.js project structure is in place, including `src/index.ts` for the main application and `src/middlewares/ratelimit.ts` for the rate limiting middleware.
- **Middleware Scaffolding**: The `ratelimit.ts` file contains placeholder functions for rate limiting logic, including `updateRequestWindow`, `getRequestWindow`, and `getRateLimitConfig`.
- **Configuration**: `package.json`, `tsconfig.json`, and ESLint/Prettier configurations are set up for a modern TypeScript development environment.
- **Memory Bank**: The core Memory Bank files (`projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`) have been initialized with foundational project information.

## What's Left to Build

- **ENV Setup**: create .env file and load it.
- **PostgreSQL Integration**: Connect with the pg server.
- **Redis Integration**: Connect with the redis server.
- **Docker**: Set up every server/service (redis, postgres, express, etc) inside docker.
- **Middleware**: The current rate limiting middleware uses placeholder functions. Actual integration with a Redis client is required.
- **Atomic Rate Limiting Logic**: The core sliding-window logic, including atomic operations using Redis Lua scripting, needs to be implemented.
- **API Key Extraction**: Implement robust extraction of the API key from incoming requests.
- **Per-Endpoint Configuration**: Develop a mechanism to define and retrieve rate limits specific to different API endpoints.
  - **Endpoint 1**: An endpoint to set config for each api key.
  - **Endpoint 2**: An endpoint to get config for each api key (cached with redis).
- **Error Handling**: Implement comprehensive error handling for Redis connection issues, invalid API keys, and other potential failures.
- **Testing**: Set up unit tests for the rate limiting logic and integration tests, especially using `autocannon` for concurrency testing as specified in the project brief.

## Current Status

The project is in the initial setup phase. The foundational project context has been documented in the Memory Bank, and the basic Express application structure is ready. The critical rate limiting logic and Redis integration are yet to be implemented.

## Known Issues

- **No Rate Limiting Functionality**: Currently, the middleware does not enforce any rate limits as the Redis integration and core logic are missing.
- **Race Condition Vulnerability**: Without atomic Redis operations, any attempt to implement rate limiting would be vulnerable to race conditions under concurrent requests.

## Evolution of Project Decisions

- **Initial Decision**: To use Express.js and TypeScript for the API Gateway.
- **Early Decision**: To use Redis as the backing store for rate limiting due to its performance and atomic operation capabilities.
- **Key Decision**: To focus on the sliding-window algorithm and specifically address race conditions using Redis Lua scripting, as highlighted in the project concept.
