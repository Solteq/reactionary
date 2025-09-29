import type { SearchResult } from '../schemas/models/search.model';
import type { SearchQueryByTerm } from '../schemas/queries/search.query';
import type { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class SearchProvider<
  T extends SearchResult = SearchResult
> extends BaseProvider<T> {
  public abstract queryByTerm(payload: SearchQueryByTerm, reqCtx: RequestContext): Promise<SearchResult>;


  protected override getResourceName(): string {
    return 'product-search';
  }

}


