# Tech Context: Rate-Limited API Gateway

## Technologies Used

- **Containerization**: Docker, Docker Compose
- **Runtime**: Node.js (ES Modules)
- **Environment Variables**: dotenv (v17.4.2) - For loading environment variables from .env files.
- **Web Framework**: Express.js (v5.2.1)
- **Language**: TypeScript (v7.0.2)
- **Package Manager**: pnpm (v11.17.0)
- **TypeScript Execution**: tsx (v4.23.1) - Used for development to run TypeScript files directly.
- **Linting**: ESLint (v10.7.0) - Configured with TypeScript and Prettier integration.
- **Formatting**: Prettier (v3.9.6) - Integrated with ESLint for consistent code style.
- **Data Store**: Redis (v6.1.0) - For storing rate limiting data (timestamps, counts).
- **Database**: PostgreSQL (v8.22.0)
- **Load Testing (Planned)**: autocannon - For simulating concurrent requests to test the rate limiter.

## Development Setup

### Using Docker Compose

1.  Ensure Docker and Docker Compose are installed.
2.  Copy `.env.template` to `.env`: `cp .env.template .env`.
3.  Start services: `docker-compose up --build -d`.
4.  Stop services: `docker-compose down`.

### Manual Setup

1.  **Node.js**: Ensure Node.js is installed (version compatible with Express.js v5 and TypeScript v7).
2.  **pnpm**: Install pnpm globally (`npm install -g pnpm`).
3.  **Dependencies**: Install project dependencies using `pnpm install`.
4.  **Development Server**: Run `pnpm dev` to start the Express server with `tsx watch` for live reloading.
5.  **Build**: Use `pnpm build` to compile TypeScript to JavaScript (`dist/` directory).
6.  **Start Production**: Run `pnpm start` to execute the compiled JavaScript.

## Technical Constraints

- **Redis Dependency**: A running Redis instance is required for the rate limiter to function correctly. Connection details will need to be configured (e.g., via environment variables).
- **API Key Requirement**: The middleware expects an `x-api-key` header for identifying clients. Requests without this header will need to be handled (e.g., rejected or assigned a default, very low limit).

## Dependencies (from `package.json`)

- `dotenv`: Loads environment variables from .env files.
- `express`: Web framework.
- `redis`: Cache
- `pg`: PostgreSQL
- `zod`: Schema validation library.
- `typescript`: Language support.
- `@types/express`: Type definitions for Express.
- `@types/node`: Type definitions for Node.js.
- `@types/pg`: Type definitions for PostgreSQL.
- `eslint`, `eslint-config-prettier`, `eslint-plugin-prettier`, `eslint-plugin-simple-import-sort`, `eslint-plugin-unused-imports`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`: Linting and formatting tools.
- `prettier`: Code formatter.
- `tsx`: TypeScript execution for development.

## Tool Usage Patterns

- **`pnpm`**: Used for all package management operations (install, add, remove).
- **`tsx`**: Used for running development server and scripts directly in TypeScript.
- **`tsc`**: Used for compiling the project into JavaScript for production deployment.
- **`eslint`**: Used for static code analysis and enforcing code style.
- **`prettier`**: Used for automatic code formatting.
- **`docker-compose`**: Used for managing multi-container Docker applications.
