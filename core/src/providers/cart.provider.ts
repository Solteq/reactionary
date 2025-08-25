import { CartQuery } from "../schemas/queries/cart.query";
import { CartMutation } from "../schemas/mutations/cart.mutation";
import { BaseProvider } from "./base.provider";
import { Cart } from "../schemas/models/cart.model";
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';

export abstract class CartProvider<
  T extends Cart = Cart,
  Q extends CartQuery = CartQuery,
  M extends CartMutation = CartMutation
> extends BaseProvider<T, Q, M> {
  
  protected override generateCacheKey(query: Q, session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    const userId = session.identity?.id || 'anonymous';
    return `${providerName}:cart:${userId}:${this.hashQuery(query)}`;
  }
  
  protected override getInvalidationKeys(_mutation: M, session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    const keys: string[] = [];
    
    // Cart mutations invalidate user's cart
    const userId = session.identity?.id;
    if (userId) {
      keys.push(`${providerName}:cart:${userId}`);
    }
    
    return keys;
  }
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    const key = this.generateCacheKey(query, session);
    const ttl = this.getCacheTTL(query);
    
    // Don't cache cart for authenticated users in development
    const canCache = process.env['NODE_ENV'] === 'production' || !session.identity?.id;
    
    return {
      key,
      cacheDurationInSeconds: ttl,
      canCache
    };
  }
  
  protected override getCacheTTL(_query: Q): number {
    // Cart needs to be fresh - 30 seconds
    return 30;
  }
}