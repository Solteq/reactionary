import {
  AnalyticsProvider,
  type AnalyticsMutationProductAddToCartEvent,
  type AnalyticsMutationProductSummaryClickEvent,
  type AnalyticsMutationProductSummaryViewEvent,
  type AnalyticsMutationPurchaseEvent,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import {
  insightsClient,
  type InsightsClient,
  type ViewedObjectIDs,
  type ClickedObjectIDsAfterSearch,
  type AddedToCartObjectIDsAfterSearch,
  type PurchasedObjectIDs,
} from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import type { AlgoliaProductSearchIdentifier } from '../schema/search.schema.js';

export class AlgoliaAnalyticsProvider extends AnalyticsProvider {
  protected client: InsightsClient;
  protected config: AlgoliaConfiguration;

  constructor(
    cache: Cache,
    requestContext: RequestContext,
    config: AlgoliaConfiguration
  ) {
    super(cache, requestContext);

    this.config = config;
    this.client = insightsClient(this.config.appId, this.config.apiKey);
  }

  protected override async processProductAddToCart(
    event: AnalyticsMutationProductAddToCartEvent
  ) {
    if (event.source && event.source.type === 'search') {
      const algoliaEvent = {
        eventName: 'addToCart',
        eventType: 'conversion',
        eventSubtype: 'addToCart',
        index: this.config.indexName,
        objectIDs: [event.product.key],
        userToken: this.context.session.identityContext.personalizationKey,
        queryID: (event.source.identifier as AlgoliaProductSearchIdentifier)
          .key,
      } satisfies AddedToCartObjectIDsAfterSearch;

      this.client.pushEvents({
        events: [algoliaEvent],
      });
    }
  }

  protected override async processProductSummaryClick(
    event: AnalyticsMutationProductSummaryClickEvent
  ) {
    if (event.source && event.source.type === 'search') {
      const algoliaEvent = {
        eventName: 'click',
        eventType: 'click',
        index: this.config.indexName,
        objectIDs: [event.product.key],
        userToken: this.context.session.identityContext.personalizationKey,
        positions: [event.position],
        queryID: (event.source.identifier as AlgoliaProductSearchIdentifier)
          .key,
      } satisfies ClickedObjectIDsAfterSearch;

      this.client.pushEvents({
        events: [algoliaEvent],
      });
    }
  }

  protected override async processProductSummaryView(
    event: AnalyticsMutationProductSummaryViewEvent
  ) {
    if (event.source && event.source.type === 'search') {
      const algoliaEvent = {
        eventName: 'view',
        eventType: 'view',
        index: this.config.indexName,
        objectIDs: event.products.map((x) => x.key),
        userToken: this.context.session.identityContext.personalizationKey,
      } satisfies ViewedObjectIDs;

      this.client.pushEvents({
        events: [algoliaEvent],
      });
    }
  }

  protected override async processPurchase(
    event: AnalyticsMutationPurchaseEvent
  ): Promise<void> {
    const algoliaEvent = {
      eventName: 'purchase',
      eventType: 'conversion',
      eventSubtype: 'purchase',
      index: this.config.indexName,
      objectIDs: event.order.items.map((x) => x.identifier.key),
      userToken: this.context.session.identityContext.personalizationKey,
    } satisfies PurchasedObjectIDs;

    this.client.pushEvents({
      events: [algoliaEvent],
    });
  }
}
