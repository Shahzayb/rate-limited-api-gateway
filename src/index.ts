import express, { type Express, type Request, type Response } from 'express';
import { ratelimit } from './middlewares/ratelimit.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { connectPostgres, disconnectPostgres } from './db/postgres.js';

const app: Express = express();

app.get('/', ratelimit, (req: Request, res: Response) => {
  res.send('Hello World!');
});

const startServer = async () => {
  await connectRedis();
  await connectPostgres();

  app.listen(3000, () => {
    console.log('Server is running on port 3000');
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
