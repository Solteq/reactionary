import { AnalyticsEvent } from '../schemas/models/analytics.model';
import { AnalyticsMutation } from '../schemas/mutations/analytics.mutation';
import { AnalyticsQuery } from '../schemas/queries/analytics.query';
import { BaseProvider } from './base.provider';

export abstract class AnalyticsProvider<
  T extends AnalyticsEvent = AnalyticsEvent,
  Q extends AnalyticsQuery = AnalyticsQuery,
  M extends AnalyticsMutation = AnalyticsMutation
> extends BaseProvider<T, Q, M> {}