import { SearchResult } from '../schemas/models/search.model';
import { SearchQueryByTerm } from '../schemas/queries/search.query';
import { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class SearchProvider<
  T extends SearchResult = SearchResult
> extends BaseProvider<T> {
  public abstract queryByTerm(payload: SearchQueryByTerm, reqCtx: RequestContext): Promise<SearchResult>;


  protected override getResourceName(): string {
    return 'product-search';
  }

}


