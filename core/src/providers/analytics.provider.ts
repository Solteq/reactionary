import type { RequestContext } from '../schemas/session.schema.js';
import { BaseProvider } from './base.provider.js';
import type { Cache } from '../cache/cache.interface.js';
import { AnalyticsMutationSchema, type AnalyticsMutation } from '../schemas/index.js';
import { Reactionary } from '../decorators/reactionary.decorator.js';

export abstract class AnalyticsProvider extends BaseProvider {
  protected override getResourceName(): string {
    return 'analytics';
  }

  public abstract track(event: AnalyticsMutation): Promise<void>;
}

export class MulticastAnalyticsProvider extends AnalyticsProvider {
  protected providers: Array<AnalyticsProvider>;

  constructor(cache: Cache, requestContext: RequestContext, providers: Array<AnalyticsProvider>) {
    super(cache, requestContext);

    this.providers = providers;
  }

  @Reactionary({
    inputSchema: AnalyticsMutationSchema
  })
  public async track(event: AnalyticsMutation) {
    for (const provider of this.providers) {
      provider.track(event);
    }
  }
}