import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { withPosthogCapabilities } from '@reactionary/provider-posthog';
import { faker } from '@faker-js/faker';

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
    { product: false }
  ),
  withFakeCapabilities(
    {
      jitter: {
        mean: 300,
        deviation: 100,
      },
    },
    { search: false, product: true }
  ),
  withPosthogCapabilities(
    {
      apiKey: process.env['POSTHOG_API_KEY'] || '',
      host: process.env['POSTHOG_HOST'] || '',
    },
    { analytics: true }
  ),
]);

const app = express();

app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
  })
);
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => {
      return {
        client,
        session: {
          // TODO: This should obviously not be a random uuid, but that is part of the session story
          id: faker.string.uuid(),
          user: faker.string.uuid(),
        },
      };
    },
  })
);

app.listen(3000);
