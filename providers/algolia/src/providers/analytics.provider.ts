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
  type InsightsClient,
  type ViewedObjectIDs,
  type ClickedObjectIDsAfterSearch,
  type AddedToCartObjectIDsAfterSearch,
  type PurchasedObjectIDs,
  algoliasearch,
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
    this.client = algoliasearch(this.config.appId, this.config.apiKey).initInsights({});
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

      const response = await this.client.pushEvents({
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

      const response = await this.client.pushEvents({
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

      const response = await this.client.pushEvents({
        events: [algoliaEvent],
      });
    }
  }

  protected override async processPurchase(
    event: AnalyticsMutationPurchaseEvent
  ): Promise<void> {
    // TODO: Figure out how to handle the problem below. From the order we have the SKUs,
    // but in Algolia we have the products indexed, and we can't really resolve it here...
    const algoliaEvent = {
      eventName: 'purchase',
      eventType: 'conversion',
      eventSubtype: 'purchase',
      index: this.config.indexName,
      objectIDs: event.order.items.map((x) => x.variant.sku),
      userToken: this.context.session.identityContext.personalizationKey,
    } satisfies PurchasedObjectIDs;

    const response = await this.client.pushEvents({
      events: [algoliaEvent],
    });
  }
}
