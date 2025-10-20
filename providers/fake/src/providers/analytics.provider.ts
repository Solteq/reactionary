import { AnalyticsEventSchema, type AnalyticsEvent, type Cache } from '@reactionary/core';
import type { AnalyticsProvider } from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeAnalyticsProvider implements AnalyticsProvider {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, cache: Cache) {
    this.config = config;
  }

  public async track(event: AnalyticsEvent): Promise<void> {
    const e = AnalyticsEventSchema.parse(event);
    
    switch(e.event) {
      case 'product-search-click':
        console.log('product-search-click');
        break;
      case 'search':
        console.log('search');
        break;
    }
  }
}
