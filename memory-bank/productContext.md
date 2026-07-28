# Product Context: Rate-Limited API Gateway

## Purpose

Practical implementation of robust API gateway rate limiting.

## Problems Solved

1. Race conditions in naive rate limiters
2. Concurrency handling challenges
3. API protection from abuse
4. Granular resource control

## How It Works

Express middleware that for each request:

1. Identifies API key and endpoint
2. Checks Redis for request count in sliding window
3. Allows or blocks (429 + Retry-After) based on limits
4. Atomically updates counts

## User Experience Goals

- Fair usage enforcement
- Clear rate limit feedback
- Minimal performance overhead

## Study Alongside

This project is designed to be a learning experience, encouraging the study of:

- **Redis EVAL/Lua Scripting**: For implementing atomic operations to prevent race conditions.
- **Rate Limiting Algorithms**: Understanding the trade-offs between token bucket, sliding window, and fixed window algorithms.
