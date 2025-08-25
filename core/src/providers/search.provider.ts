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
  
  protected override getCacheEvaluation(query: Q, _session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    // Hash search parameters (term, filters, pagination, etc.)
    const searchHash = crypto.createHash('md5').update(JSON.stringify(query.search)).digest('hex').substring(0, 12);
    const key = `${providerName}:search:${searchHash}`;
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }
}


