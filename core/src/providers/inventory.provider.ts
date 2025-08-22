import { Inventory } from '../schemas/models/inventory.model';
import { InventoryQuery } from '../schemas/queries/inventory.query';
import { InventoryMutation } from '../schemas/mutations/inventory.mutation';
import { BaseCachedProvider } from './base-cached.provider';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';

export abstract class InventoryProvider<
  T extends Inventory = Inventory,
  Q extends InventoryQuery = InventoryQuery,
  M extends InventoryMutation = InventoryMutation
> extends BaseCachedProvider<T, Q, M> {
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    if (!this.shouldCache(session)) {
      return {
        key: '',
        cacheDurationInSeconds: 0,
        canCache: false
      };
    }
    
    const key = this.generateCacheKey(query, session);
    const ttl = this.getCacheTTL(query);
    
    return {
      key,
      cacheDurationInSeconds: ttl,
      canCache: true
    };
  }
  
  protected override generateCacheKey(query: Q, _session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    return `${providerName}:inventory:${query.sku}`;
  }
  
  protected override getInvalidationKeys(mutation: M, _session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    const keys: string[] = [];
    
    // Check if this mutation affects inventory
    if ('sku' in mutation && typeof mutation['sku'] === 'string') {
      keys.push(`${providerName}:inventory:${mutation['sku']}`);
    }
    
    return keys;
  }
  
  protected override shouldCache(session: Session): boolean {
    // Global caching controls
    if (process.env['NODE_ENV'] === 'test' || process.env['DISABLE_CACHE'] === 'true') {
      return false;
    }
    
    // Check if Redis configuration is available
    if (!(process.env['UPSTASH_REDIS_REST_URL'] || process.env['REDIS_URL'])) {
      return false;
    }
    
    return true;
  }
  
  protected override getCacheTTL(_query: Q): number {
    // Inventory changes frequently - 1 minute
    return 60;
  }
}
