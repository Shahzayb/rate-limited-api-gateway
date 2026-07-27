# Rate-Limited API Gateway

Express.js middleware implementing a sliding-window rate limiter using Redis with atomic operations.

## Features

- Sliding-window rate limiting algorithm
- Redis backend with Lua scripting for atomic operations
- API key based identification (x-api-key header)
- Per-endpoint rate limit configuration
- 429 Too Many Requests responses with Retry-After headers

## Quick Start

To get started with the project, you can use Docker Compose for a quick setup of all services (PostgreSQL, Redis, and the Node.js server).

### Using Docker Compose

1. Ensure you have Docker and Docker Compose installed.
2. Create a `.env` file in the root directory by copying `.env.template`:
   `cp .env.template .env`
3. Start the services:
   `docker-compose up --build -d`
4. To stop the services:
   `docker-compose down`

### Manual Setup (without Docker Compose)

1. Install dependencies: `pnpm install`
2. Create `.env` file with environment variables (refer to `.env.template` for required variables).
3. Start development server: `pnpm dev`

## Scripts

- `pnpm dev`: Start development server with live reload
- `pnpm build`: Compile TypeScript to JavaScript
- `pnpm start`: Run production server
- `pnpm format`: Format code with Prettier
- `pnpm lint`: Run ESLint
- `pnpm docker:up`: Start Docker Compose services in detached mode
- `pnpm docker:down`: Stop and remove Docker Compose services
- `pnpm docker:logs`: View logs for Docker Compose services
- `pnpm docker:build`: Build Docker images for services

## Configuration

Environment variables are validated at startup:

- `REDIS_URL`: Redis connection string
- `PG_URL`: PostgreSQL connection string
- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)

For detailed documentation, see the [Memory Bank](memory-bank/) files.
