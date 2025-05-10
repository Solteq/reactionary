import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';

const app = express();

app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => {
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
          { products: true }
        ),
      ]);

      return {
        client
      }
    }
  })
);

app.listen(3000);