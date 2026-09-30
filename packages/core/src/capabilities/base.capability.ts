import type { Cache } from '../cache/cache.interface.js';
import { type RequestContext } from '../schemas/session.schema.js';
import { hasher } from "node-object-hash";
import {
  REACTIONARY_ENTRYPOINT_METADATA,
  type ReactionaryEntrypointMetadata,
  type ReactionaryEntrypointMethod,
} from '../decorators/reactionary.metadata.js';

export type {
  ReactionaryEntrypointMetadata,
  ReactionaryEntrypointMethod,
} from '../decorators/reactionary.metadata.js';

/**
 * Base capability abstraction, responsible for mutations (changes) and queries (fetches)
 * for a given business object domain.
 */
export abstract class BaseCapability {
  protected cache: Cache;
  protected context: RequestContext;

  constructor(cache: Cache, context: RequestContext) {
    this.cache = cache;
    this.context = context;
  }

  public getReactionaryResourceName(): string {
    return this.getResourceName();
  }

  public generateDependencyIdsForModel(model: unknown): Array<string> {
    // TODO: Messy because we can't guarantee that a model has an identifier (type-wise)
   const identifier = (model as any)?.identifier;

   if (!identifier) {
    return [];
   }

   const h = hasher({ sort: true, coerce: false });
   const hash = h.hash(identifier);

   return [hash ];
  }

  protected generateCacheKeyForQuery(scope: string, query: object, locale: string, currency: string): string {
    const h = hasher({ sort: true, coerce: false });

    const queryHash = h.hash(query );

    // TODO: This really should include the internationalization parts as well (locale, currency, etc), or at least provide the option
    // for specifying in the decorator whether they do (eg categories don't really seem to depend on currency...)

    return `${scope}:${queryHash}:${locale}:${currency}`;
  }

  /**
   * Returns the abstract resource name provided by the remote system.
   */
  protected abstract getResourceName(): string;
}

export function getReactionaryEntrypoints(
  capability: BaseCapability,
): ReactionaryEntrypointMetadata[] {
  const entrypoints: ReactionaryEntrypointMetadata[] = [];
  const seenMethodNames = new Set<string>();
  let prototype: object | null = Object.getPrototypeOf(capability);

  while (prototype && prototype !== BaseCapability.prototype) {
    for (const propertyName of Object.getOwnPropertyNames(prototype)) {
      if (propertyName === 'constructor' || seenMethodNames.has(propertyName)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (typeof descriptor?.value !== 'function') {
        continue;
      }

      seenMethodNames.add(propertyName);
      const method = descriptor.value as ReactionaryEntrypointMethod;
      const metadata = method[REACTIONARY_ENTRYPOINT_METADATA];
      if (!metadata) {
        continue;
      }

      entrypoints.push({
        ...metadata,
        capabilityName: capability.getReactionaryResourceName(),
      });
    }

    prototype = Object.getPrototypeOf(prototype);
  }

  return entrypoints;
}
