import { CartQuery } from "../schemas/queries/cart.query";
import { CartMutation } from "../schemas/mutations/cart.mutation";
import { BaseProvider } from "./base.provider";
import { Cart } from "../schemas/models/cart.model";
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';
import * as crypto from 'crypto';

export abstract class CartProvider<
  T extends Cart = Cart,
  Q extends CartQuery = CartQuery,
  M extends CartMutation = CartMutation
> extends BaseProvider<T, Q, M> {
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    const userId = session.identity?.id || 'anonymous';
    const queryHash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex').substring(0, 12);
    const key = `${providerName}:cart:${userId}:${queryHash}`;
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }
}