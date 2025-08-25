import { SearchResult } from '../schemas/models/search.model';
import { SearchQuery } from '../schemas/queries/search.query';
import { SearchMutation } from '../schemas/mutations/search.mutation';
import { BaseProvider } from './base.provider';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';
import * as crypto from 'crypto';

export abstract class SearchProvider<
  T extends SearchResult = SearchResult,
  Q extends SearchQuery = SearchQuery,
  M extends SearchMutation = SearchMutation
> extends BaseProvider<T, Q, M> {
  
  protected override generateCacheKey(query: Q, _session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    return `${providerName}:search:${this.hashSearch(query.search)}`;
  }
  
  protected override getInvalidationKeys(_mutation: M, _session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    // Search mutations typically invalidate all search results
    return [`${providerName}:search:*`];
  }
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    const key = this.generateCacheKey(query, session);
    const ttl = this.getCacheTTL(query);
    
    return {
      key,
      cacheDurationInSeconds: ttl,
      canCache: true
    };
  }
  
  protected override getCacheTTL(_query: Q): number {
    // Search results can be cached longer - 10 minutes by default
    let ttl = 600;
    
    // Provider-specific overrides based on actual implementation class
    const implementationClass = this.constructor.name;
    if (implementationClass.includes('Algolia')) {
      // Algolia has fast responses, can cache longer
      ttl = 900; // 15 minutes
    } else if (implementationClass.includes('Elasticsearch')) {
      // Elasticsearch might have more dynamic data
      ttl = 300; // 5 minutes
    }
    
    return ttl;
  }
  
  protected hashSearch(search: unknown): string {
    // Hash search parameters (term, filters, pagination, etc.)
    return crypto.createHash('md5').update(JSON.stringify(search)).digest('hex').substring(0, 12);
  }
}


