import { buildClient } from "@reactionary/core";
import { withAlgoliaCapabilities } from "@reactionary/provider-algolia";
import { withCommercetoolsCapabilities } from "@reactionary/provider-commercetools";
import { withFakeCapabilities } from "@reactionary/provider-fake";
import { withPosthogCapabilities } from "@reactionary/provider-posthog";
import { createTRPCRouter } from "@reactionary/trpc";

/**
 * TODO: This would likely be cleaner with:
 * - implicit processing of parameters from the environment
 * - as a builder-pattern
 */
export const client = buildClient([
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

export const mergedRouter = createTRPCRouter(client);

export type RouterType = typeof mergedRouter;