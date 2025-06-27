import { SearchResult } from '../schemas/models/search.model';
import { SearchQuery } from '../schemas/queries/search.query';
import { SearchMutation } from '../schemas/mutations/search.mutation';
import { BaseProvider } from './base.provider';

export abstract class SearchProvider<
  T extends SearchResult = SearchResult,
  Q extends SearchQuery = SearchQuery,
  M extends SearchMutation = SearchMutation
> extends BaseProvider<T, Q, M> {}


