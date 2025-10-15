import type { AnalyticsEvent } from '../schemas/models/analytics.model.js';
import { BaseProvider } from './base.provider.js';

export abstract class AnalyticsProvider<
  T extends AnalyticsEvent = AnalyticsEvent
> extends BaseProvider<T> {


  protected override getResourceName(): string {
    return 'analytics';
  }
}
