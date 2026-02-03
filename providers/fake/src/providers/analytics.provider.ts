import type {
  AnalyticsMutation,
  Cache,
  RequestContext} from '@reactionary/core';
import {
  AnalyticsProvider
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeAnalyticsProvider extends AnalyticsProvider {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);

    this.config = config;
  }

  public override async track(event: AnalyticsMutation): Promise<void> {
    // No-op
  }
}