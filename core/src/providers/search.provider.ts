import { SearchIdentifier } from '../schemas/identifiers.schema';
import { SearchResult } from '../schemas/search.schema';
import { z } from 'zod';

export abstract class SearchProvider<T = SearchResult> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  protected base(): T {
    return this.schema.parse({});
  }

  public parse(data: unknown, query: SearchIdentifier): T {
    return data as T;
  }

  public abstract get(identifier: SearchIdentifier): Promise<T>;
}

