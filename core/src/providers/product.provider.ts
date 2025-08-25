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
  
  protected override getCacheEvaluation(query: Q, _session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    
    let key: string;
    if (query.query === 'slug') {
      key = `${providerName}:product:slug:${(query as ProductQueryBySlug).slug}`;
    } else if (query.query === 'id') {
      key = `${providerName}:product:id:${(query as ProductQueryById).id}`;
    } else {
      const queryHash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
      key = `${providerName}:product:${queryHash}`;
    }
    
    return {
      key,
      cacheDurationInSeconds: 300, // Products are moderately stable - 5 minutes
      canCache: true
    };
  }
}
