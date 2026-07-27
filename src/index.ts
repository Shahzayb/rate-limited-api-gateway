import express, { type Express, type Request, type Response } from 'express';
import { ratelimit } from './middlewares/ratelimit.js';

const app: Express = express();

app.get('/', ratelimit, (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
