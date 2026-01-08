import type { Cache } from '../cache/cache.interface.js';
import { type RequestContext } from '../schemas/session.schema.js';
import { hasher } from "node-object-hash";

/**
 * Base capability provider, responsible for mutations (changes) and queries (fetches)
 * for a given business object domain.
 */
export abstract class BaseProvider {
  protected cache: Cache;
  protected context: RequestContext;

  constructor(cache: Cache, context: RequestContext) {
    this.cache = cache;
    this.context = context;
  }
  
  public generateDependencyIdsForModel(model: unknown): Array<string> {
    // TODO: Messy because we can't guarantee that a model has an identifier (type-wise)
   const identifier = (model as any)?.identifier;

   if (!identifier) {
    return [];
   }

   const h = hasher({ sort: true, coerce: false });
   const hash = h.hash(identifier);

   return [hash];
  }

  protected generateCacheKeyForQuery(scope: string, query: object): string {
    const h = hasher({ sort: true, coerce: false });

    const queryHash = h.hash(query);

    // TODO: This really should include the internationalization parts as well (locale, currency, etc), or at least provide the option
    // for specifying in the decorator whether they do (eg categories don't really seem to depend on currency...)

    return `${scope}:${queryHash}`;
  }

  /**
   * Returns the abstract resource name provided by the remote system.
   */
  protected abstract getResourceName(): string;
}
