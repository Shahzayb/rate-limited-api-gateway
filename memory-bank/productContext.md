# Product Context: Rate-Limited API Gateway

## Why This Project Exists

This project serves as a practical exploration and implementation of a robust rate-limiting mechanism for API gateways. The core motivation stems from the common pitfalls and challenges associated with implementing rate limiters, particularly in concurrent environments.

## Problems It Solves

1.  **Race Conditions in Naive Implementations**: Many straightforward rate-limiting approaches (e.g., using `INCR` and `EXPIRE` in Redis without proper synchronization) are susceptible to race conditions. This can lead to more requests being processed than the defined limit, undermining the purpose of rate limiting. This project aims to solve this by implementing atomic operations.
2.  **Concurrency Handling**: Ensures that the rate limiter behaves correctly and consistently under high concurrent load, preventing system overload and abuse.
3.  **API Protection**: Provides a mechanism to protect backend services from excessive requests, ensuring fair usage and preventing denial-of-service attacks.
4.  **Controlled Resource Access**: Allows for fine-grained control over how frequently specific API keys or endpoints can access resources.

## How It Should Work

The rate limiter will operate as an Express.js middleware. For each incoming request:

1.  It will identify the API key and the target endpoint.
2.  It will consult Redis to determine the current request count within the defined sliding window for that API key and endpoint.
3.  If the request count is within the limit, the request will proceed, and the count will be atomically updated in Redis.
4.  If the request count exceeds the limit, the request will be blocked, and a `429 Too Many Requests` response will be returned, along with a `Retry-After` header.

## User Experience Goals

- **Fair Usage**: Ensure that all API consumers adhere to their allocated rate limits.
- **Clear Feedback**: Provide clear HTTP status codes and headers (`429` and `Retry-After`) when limits are exceeded, allowing clients to gracefully handle rate limiting.
- **Performance**: The rate limiting mechanism should introduce minimal overhead to API request processing.

## Study Alongside

This project is designed to be a learning experience, encouraging the study of:

- **Redis EVAL/Lua Scripting**: For implementing atomic operations to prevent race conditions.
- **Rate Limiting Algorithms**: Understanding the trade-offs between token bucket, sliding window, and fixed window algorithms.
