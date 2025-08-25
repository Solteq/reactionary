import { AnalyticsEvent } from '../schemas/models/analytics.model';
import { AnalyticsMutation } from '../schemas/mutations/analytics.mutation';
import { AnalyticsQuery } from '../schemas/queries/analytics.query';
import { BaseProvider } from './base.provider';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';
import * as crypto from 'crypto';

export abstract class AnalyticsProvider<
  T extends AnalyticsEvent = AnalyticsEvent,
  Q extends AnalyticsQuery = AnalyticsQuery,
  M extends AnalyticsMutation = AnalyticsMutation
> extends BaseProvider<T, Q, M> {
  
  protected override getCacheEvaluation(query: Q, _session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    
    // Hash analytics query parameters
    const relevantFields = {
      type: typeof query === 'object' && query !== null && 'type' in query ? (query as any).type : undefined,
      dateRange: typeof query === 'object' && query !== null && 'dateRange' in query ? (query as any).dateRange : undefined,
      filters: typeof query === 'object' && query !== null && 'filters' in query ? (query as any).filters : undefined
    };
    const analyticsHash = crypto.createHash('md5').update(JSON.stringify(relevantFields)).digest('hex').substring(0, 12);
    const key = `${providerName}:analytics:${analyticsHash}`;
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }
}