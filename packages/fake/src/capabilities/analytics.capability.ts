import type {
  AnalyticsMutation,
  Cache,
  RequestContext} from '@reactionary/core';
import {
  LegacyAnalyticsProvider
} from '@reactionary/core';
import type * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeAnalyticsCapability extends LegacyAnalyticsProvider {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);

    this.config = config;
  }

  protected override getResourceName(): string {
    return 'fake-analytics';
  }

  public override async track(event: AnalyticsMutation) {
    return this.ignored();
  }
}