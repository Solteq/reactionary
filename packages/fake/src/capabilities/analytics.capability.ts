import type {
  AnalyticsMutation,
  Cache,
  RequestContext} from '@reactionary/core';
import {
  AnalyticsCapability
} from '@reactionary/core';
import type * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeAnalyticsCapability extends AnalyticsCapability {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);

    this.config = config;
  }

  public override async track(event: AnalyticsMutation): Promise<void> {
    // No-op
  }
}