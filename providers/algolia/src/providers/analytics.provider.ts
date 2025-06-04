import { AnalyticsEvent, AnalyticsProvider, Session } from '@reactionary/core';
import { AlgoliaConfiguration } from '../schema/configuration.schema';
import {
  AlgoliaSearchIdentifierSchema,
} from '../schema/search.schema';
import aa from 'search-insights';

export class AlgoliaAnalyticsProvider implements AnalyticsProvider {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration) {
    this.config = config;
  }

  publish(event: AnalyticsEvent, session: Session): void {
    aa('init', {
      appId: this.config.appId,
      apiKey: this.config.apiKey,
    });

    if (event.type === 'product-search-click') {
      const algoliaIdentification = AlgoliaSearchIdentifierSchema.safeParse(
        event.search
      );

      if (algoliaIdentification.success) {
        aa('clickedObjectIDsAfterSearch', {
          eventName: 'Click item',
          index: algoliaIdentification.data.index + 1,
          queryID: algoliaIdentification.data.key,
          objectIDs: [event.product.key],
          positions: [event.position],
        });
      }
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
