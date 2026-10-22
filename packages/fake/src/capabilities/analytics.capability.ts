import {
  AnalyticsProvider,
  type AnalyticsEventType,
  type AnalyticsOutcome,
  type AnalyticsPurpose,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

/**
 * Analytics provider for fake-backed clients. It subscribes to everything and ignores it all.
 */
export class FakeAnalyticsCapability extends AnalyticsProvider {
  public readonly types: ReadonlyArray<AnalyticsEventType | `${string}*`> = ['*'];
  public readonly purpose: AnalyticsPurpose = 'necessary';

  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);

    this.config = config;
  }

  protected override getResourceName(): string {
    return 'fake-analytics';
  }

  public async handle(): Promise<AnalyticsOutcome> {
    return 'ignored';
  }
}
