# Project Brief: Rate-Limited API Gateway

## Core Requirements

Build robust Express.js middleware implementing a sliding-window rate limiter that handles concurrency correctly.

### Key Objectives:

1. Implement Redis-backed sliding-window rate limiting
2. Ensure atomic operations to prevent race conditions
3. Support API key-based and per-endpoint limits
4. Return proper HTTP responses (429 + Retry-After)
5. Validate with concurrency testing (50 requests @ limit 10)

## Focus

Understanding and solving the "naive INCR + EXPIRE race condition" problem.
