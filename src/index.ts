import express, { type Express, type Request, type Response } from 'express';
import { config } from './config.js';
import { ratelimit } from './middlewares/ratelimit.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { connectPostgres, disconnectPostgres } from './db/postgres.js';

const app: Express = express();

app.get('/', ratelimit, (req: Request, res: Response) => {
  res.send('Hello New World!');
});

const startServer = async () => {
  await connectRedis();
  await connectPostgres();

  app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
  });
};

startServer();

process.on('SIGINT', async () => {
  await disconnectRedis();
  await disconnectPostgres();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
  await disconnectPostgres();
  process.exit(0);
});
