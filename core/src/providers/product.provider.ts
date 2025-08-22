import { Product } from '../schemas/models/product.model';
import { ProductMutation } from '../schemas/mutations/product.mutation';
import { ProductQuery, ProductQueryById, ProductQueryBySlug } from '../schemas/queries/product.query';
import { BaseCachedProvider } from './base-cached.provider';
import { Session } from '../schemas/session.schema';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import * as crypto from 'crypto';

export abstract class ProductProvider<
  T extends Product = Product,
  Q extends ProductQuery = ProductQuery,
  M extends ProductMutation = ProductMutation
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
    
    if (query.query === 'slug') {
      return `${providerName}:product:slug:${(query as ProductQueryBySlug).slug}`;
    } else if (query.query === 'id') {
      return `${providerName}:product:id:${(query as ProductQueryById).id}`;
    } else {
      return `${providerName}:product:${this.hashQuery(query)}`;
    }
  }
  
  protected override getInvalidationKeys(mutation: M, _session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    const keys: string[] = [];
    
    // Check if this mutation affects products
    const productId = ('id' in mutation && mutation['id']) || ('slug' in mutation && mutation['slug']);
    if (productId && typeof productId === 'string') {
      keys.push(`${providerName}:product:id:${productId}`);
      keys.push(`${providerName}:product:slug:${productId}`);
      // Product changes also invalidate search results
      keys.push(`${providerName.replace('product', 'search')}:search:*`);
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
    // Products are moderately stable - 5 minutes default
    return 300;
  }
  
  protected override hashQuery(query: Q): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
  }
}
