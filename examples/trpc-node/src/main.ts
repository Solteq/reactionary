import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { Client } from '@reactionary/core';
import session from 'express-session';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { Redis } from 'ioredis';
import { RedisStore } from 'connect-redis';
import { client, mergedRouter } from './router-instance';

const app = express();

export function createContext(client: Client) {
  return async ({ req, res, info }: CreateExpressContextOptions) => {
    const session = (req as any).session || {};

    return {
      session,
      client,
    };
  };
}

app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
  })
);

const redis = new Redis(process.env['SESSION_STORE_REDIS_CONNECTION']);

const store = new RedisStore({
  client: redis,
});

app.use(
  session({
    store: store,
    secret: process.env['SESSION_STORE_SECRET'],
    cookie: {},
    resave: true,
    saveUninitialized: true,
  })
);

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: mergedRouter,
    createContext: createContext(client),
  })
);

const server = app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
  // OpenTelemetry automatically initializes based on OTEL_* environment variables
});

