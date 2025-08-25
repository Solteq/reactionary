import { Product } from '../schemas/models/product.model';
import { ProductMutation } from '../schemas/mutations/product.mutation';
import { ProductQuery, ProductQueryById, ProductQueryBySlug } from '../schemas/queries/product.query';
import { BaseProvider } from './base.provider';
import { Session } from '../schemas/session.schema';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import * as crypto from 'crypto';

export abstract class ProductProvider<
  T extends Product = Product,
  Q extends ProductQuery = ProductQuery,
  M extends ProductMutation = ProductMutation
> extends BaseProvider<T, Q, M> {
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
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
  
  protected override getCacheTTL(_query: Q): number {
    // Products are moderately stable - 5 minutes default
    return 300;
  }
  
  protected override hashQuery(query: Q): string {
    return crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
  }
}
