import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

const isProduction = process.env.NODE_ENV === 'production';

const config: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  mixin() {
    const store = asyncLocalStorage.getStore() as { requestId: string } | undefined;
    return store ? { requestId: store.requestId } : {};
  },
};

if (!isProduction) {
  config.transport = {
    target: 'pino-pretty',
  };
}

const logger = pino(config);

export { logger, asyncLocalStorage };
