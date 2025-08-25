import { Price } from '../schemas/models/price.model';
import { PriceMutation } from '../schemas/mutations/price.mutation';
import { PriceQuery } from '../schemas/queries/price.query';
import { BaseProvider } from './base.provider';
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';
import * as crypto from 'crypto';

export abstract class PriceProvider<
  T extends Price = Price,
  Q extends PriceQuery = PriceQuery,
  M extends PriceMutation = PriceMutation
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
    return `${providerName}:price:${this.hashSku(query.sku)}`;
  }
  
  protected override getInvalidationKeys(mutation: M, _session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    const keys: string[] = [];
    
    // Check if this mutation affects prices
    if ('sku' in mutation) {
      keys.push(`${providerName}:price:${this.hashSku(mutation['sku'])}`);
    }
    
    return keys;
  }
  
  protected override getCacheTTL(_query: Q): number {
    // Prices change more often than products - 3 minutes
    return 180;
  }
  
  protected hashSku(sku: unknown): string {
    // Hash complex SKU objects (price queries with currency, customer group, etc.)
    return crypto.createHash('md5').update(JSON.stringify(sku)).digest('hex').substring(0, 12);
  }
}
