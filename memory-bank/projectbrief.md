# Project Brief: Rate-Limited API Gateway

## Core Requirements and Goals

The primary goal of this project is to build a robust and efficient Express.js middleware that implements a sliding-window rate limiter. This rate limiter will be designed to handle concurrency correctly, specifically addressing the race conditions inherent in naive implementations.

### Key Objectives:

1.  **Sliding-Window Limiter**: Implement a rate limiting mechanism based on the sliding-window algorithm.
2.  **Redis Integration**: Utilize Redis as the backend for storing rate limiting data.
3.  **Atomic Operations**: Ensure atomicity for all read and write operations to Redis, specifically to prevent race conditions during concurrent requests. This will likely involve Redis Lua scripting (`EVAL`).
4.  **API Key Based**: The rate limiter should key requests by an API key (e.g., from `x-api-key` header).
5.  **Per-Endpoint Limits**: Support defining different rate limits for individual API endpoints.
6.  **Proper HTTP Responses**: When a rate limit is exceeded, respond with a `429 Too Many Requests` HTTP status code and include a `Retry-After` header indicating when the client can retry.
7.  **Concurrency Testing**: The implementation must be verifiable under high concurrency. A key self-check involves firing 50 concurrent requests at a limit of 10 using `autocannon` and ensuring no more than 10 succeed. This specifically targets the race condition scenario.

## Concept Focus

This project is also a learning exercise focused on understanding how rate limiting truly works under concurrency, beyond simple request counting. It emphasizes identifying and solving the "naive INCR + EXPIRE has a race condition" problem.
