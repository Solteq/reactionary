/**
 * Example Next.js route module shape for mounting ReactionaryFeedServer.
 *
 * Copy the relevant parts into `app/feeds/[...path]/route.ts` or a similar
 * catch-all route. Replace `createClient` and `feedsConfig` with your actual
 * project setup.
 */

import {
  ReactionaryFeedServer,
  createReactionaryFeedClientFactoryFromEnv,
} from '@reactionary/feeds';
import feedsConfig from './feeds.config.mjs';

const server = new ReactionaryFeedServer(
  feedsConfig.createClient ?? createReactionaryFeedClientFactoryFromEnv(),
  {
    feeds: feedsConfig.feeds,
    sitemaps: feedsConfig.sitemaps,
    defaultFulfillmentCenterKeys: feedsConfig.defaultFulfillmentCenterKeys,
    productConcurrency: feedsConfig.productConcurrency,
  },
);

export function GET(request) {
  return server.fetch(request);
}

export function HEAD(request) {
  return server.fetch(request);
}
