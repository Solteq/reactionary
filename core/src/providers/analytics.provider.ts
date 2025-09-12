import { AnalyticsEvent } from '../schemas/models/analytics.model';
import { BaseProvider } from './base.provider';

export abstract class AnalyticsProvider<
  T extends AnalyticsEvent = AnalyticsEvent
> extends BaseProvider<T> {
}