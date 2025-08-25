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
  
  protected override generateCacheKey(query: Q, _session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    return `${providerName}:analytics:${this.hashAnalytics(query)}`;
  }
  
  protected override getInvalidationKeys(_mutation: M, _session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    // Analytics mutations might invalidate analytics caches
    // This is typically rare, but could invalidate aggregated data
    return [`${providerName}:analytics:*`];
  }
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    const key = this.generateCacheKey(query, session);
    const ttl = this.getCacheTTL(query);
    
    // Cache analytics unless it's real-time data
    const canCache = !('realtime' in query && (query as any).realtime === true);
    
    return {
      key,
      cacheDurationInSeconds: ttl,
      canCache
    };
  }
  
  protected override getCacheTTL(_query: Q): number {
    // Analytics can be cached longer - 30 minutes
    return 1800;
  }
  
  protected hashAnalytics(query: Q): string {
    // Hash analytics query parameters
    const relevantFields = {
      type: typeof query === 'object' && query !== null && 'type' in query ? (query as any).type : undefined,
      dateRange: typeof query === 'object' && query !== null && 'dateRange' in query ? (query as any).dateRange : undefined,
      filters: typeof query === 'object' && query !== null && 'filters' in query ? (query as any).filters : undefined
    };
    return crypto.createHash('md5').update(JSON.stringify(relevantFields)).digest('hex').substring(0, 12);
  }
}