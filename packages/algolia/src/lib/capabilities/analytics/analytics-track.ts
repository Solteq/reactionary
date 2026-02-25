import {
  AnalyticsMutationSchema,
  success,
  type AnalyticsMutation,
  type AnalyticsTrackProcedureDefinition,
  type RequestContext,
} from '@reactionary/core';
import {
  algoliasearch,
  type AddedToCartObjectIDsAfterSearch,
  type ClickedObjectIDsAfterSearch,
  type InsightsClient,
  type PurchasedObjectIDs,
  type ViewedObjectIDs,
} from 'algoliasearch';
import * as z from 'zod';
import { algoliaProcedure, type AlgoliaProcedureContext } from '../../core/context.js';

function getUserToken(requestContext: RequestContext): string {
  return requestContext.session.identityContext?.personalizationKey || 'anonymous';
}

function getSearchQueryId(event: AnalyticsMutation): string | undefined {
  if (!('source' in event) || !event.source || event.source.type !== 'search') {
    return undefined;
  }

  const identifier = event.source.identifier as { key?: string };
  return identifier.key;
}

async function pushAnalyticsEvent(
  client: InsightsClient,
  context: AlgoliaProcedureContext,
  requestContext: RequestContext,
  event: AnalyticsMutation,
): Promise<void> {
  const userToken = getUserToken(requestContext);

  switch (event.event) {
    case 'product-cart-add': {
      const queryID = getSearchQueryId(event);
      if (!queryID) {
        return;
      }

      const algoliaEvent = {
        eventName: 'addToCart',
        eventType: 'conversion',
        eventSubtype: 'addToCart',
        index: context.config.indexName,
        objectIDs: [event.product.key],
        userToken,
        queryID,
      } satisfies AddedToCartObjectIDsAfterSearch;

      await client.pushEvents({ events: [algoliaEvent] });
      return;
    }
    case 'product-summary-click': {
      const queryID = getSearchQueryId(event);
      if (!queryID) {
        return;
      }

      const algoliaEvent = {
        eventName: 'click',
        eventType: 'click',
        index: context.config.indexName,
        objectIDs: [event.product.key],
        userToken,
        positions: [event.position],
        queryID,
      } satisfies ClickedObjectIDsAfterSearch;

      await client.pushEvents({ events: [algoliaEvent] });
      return;
    }
    case 'product-summary-view': {
      if (!('source' in event) || !event.source || event.source.type !== 'search') {
        return;
      }

      const algoliaEvent = {
        eventName: 'view',
        eventType: 'view',
        index: context.config.indexName,
        objectIDs: event.products.map((product) => product.key),
        userToken,
      } satisfies ViewedObjectIDs;

      await client.pushEvents({ events: [algoliaEvent] });
      return;
    }
    case 'purchase': {
      const algoliaEvent = {
        eventName: 'purchase',
        eventType: 'conversion',
        eventSubtype: 'purchase',
        index: context.config.indexName,
        objectIDs: event.order.items.map((item) => item.variant.sku),
        userToken,
      } satisfies PurchasedObjectIDs;

      await client.pushEvents({ events: [algoliaEvent] });
      return;
    }
    case 'product-details-view': {
      return;
    }
  }
}

export const algoliaAnalyticsTrack = algoliaProcedure({
  inputSchema: AnalyticsMutationSchema,
  outputSchema: z.void(),
  fetch: async (event, ctx, provider) => {
    const client = algoliasearch(provider.config.appId, provider.config.apiKey).initInsights({});
    await pushAnalyticsEvent(client, provider, ctx.request, event);
    return success(undefined);
  },
  transform: async (_event, _ctx, data) => {
    return success(data);
  },
}) satisfies AnalyticsTrackProcedureDefinition<AlgoliaProcedureContext>;
