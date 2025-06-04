import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';
import { faker } from '@faker-js/faker';

const client = buildClient([
  withAlgoliaCapabilities(
    {
      apiKey: process.env['ALGOLIA_API_KEY'] || '',
      appId: process.env['ALGOLIA_APP_ID'] || '',
      indexName: process.env['ALGOLIA_INDEX'] || '',
    },
    { search: true }
  ),
  withCommercetoolsCapabilities(
    {
      apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
      authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
      clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
      clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
      projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || '',
    },
    { product: true }
  ),
]);

const app = express();

const STATIC_DIRECTORY = '/app/angular-trpc/client/browser';

// Serve known static files
app.use(express.static(STATIC_DIRECTORY));

// Serve TRPC requests
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
        }
      }
    }
  })
);

// As a fallback, serve index.html
app.use((req, res) => res.sendFile(`${ STATIC_DIRECTORY }/index.html`))

app.listen(8080);
