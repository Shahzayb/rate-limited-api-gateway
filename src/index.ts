import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { ratelimit } from './middlewares/ratelimit.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { connectPostgres, disconnectPostgres } from './db/postgres.js';
import { asyncLocalStorage } from './logger.js';
import { loadPolicyCache, stopPolicyCacheRefresh } from './utils/policyCache.js';

const app: Express = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  asyncLocalStorage.run({ requestId }, () => {
    next();
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use(ratelimit);

app.get('/api/v1', (req: Request, res: Response) => {
  res.status(200).send('V1!');
});

app.get('/admin', (req: Request, res: Response) => {
  res.status(200).send('Admin!');
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

let server: ReturnType<typeof app.listen>;

const startServer = async () => {
  try {
    await connectRedis();
    await connectPostgres();
    await loadPolicyCache(); // Load policy cache after DB connections

    server = app.listen(config.PORT, () => {
      console.log(`Server is running on port ${config.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      stopPolicyCacheRefresh(); // Stop policy cache refresh
      await disconnectRedis();
      await disconnectPostgres();
      console.log('Database connections closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
