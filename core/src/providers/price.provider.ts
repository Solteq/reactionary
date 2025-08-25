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
  
  protected override getCacheEvaluation(query: Q, _session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    // Hash complex SKU objects (price queries with currency, customer group, etc.)
    const skuHash = crypto.createHash('md5').update(JSON.stringify(query.sku)).digest('hex').substring(0, 12);
    const key = `${providerName}:price:${skuHash}`;
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }
}
