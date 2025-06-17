import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { buildClient, Client } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { withPosthogCapabilities } from '@reactionary/provider-posthog';
import session from 'express-session';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { Redis } from 'ioredis';
import { RedisStore } from 'connect-redis';

/**
 * TODO: This would likely be cleaner with:
 * - implicit processing of parameters from the environment
 * - as a builder-pattern
 */
const client = buildClient([
  withAlgoliaCapabilities(
    {
      apiKey: process.env['ALGOLIA_API_KEY'] || '',
      appId: process.env['ALGOLIA_APP_ID'] || '',
      indexName: process.env['ALGOLIA_INDEX'] || '',
    },
    { search: true, analytics: true }
  ),
  withCommercetoolsCapabilities(
    {
      apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
      authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
      clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
      clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
      projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || '',
    },
    { product: true, identity: true, cart: true, inventory: true, price: true }
  ),
  withFakeCapabilities(
    {
      jitter: {
        mean: 300,
        deviation: 100,
      },
    },
    { search: false, product: false }
  ),
  withPosthogCapabilities(
    {
      apiKey: process.env['POSTHOG_API_KEY'] || '',
      host: process.env['POSTHOG_HOST'] || '',
    },
    { analytics: true }
  ),
]);

export function createContext(client: Client) {
  return async ({ req, res, info }: CreateExpressContextOptions) => {
    const session = (req as any).session || {};

    return {
      session,
      client,
    };
  };
}

const app = express();

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
    router: appRouter,
    createContext: createContext(client),
  })
);

app.listen(3000);
