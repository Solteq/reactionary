import { Identity } from "../schemas/models/identity.model";
import { IdentityQuery } from "../schemas/queries/identity.query";
import { IdentityMutation } from "../schemas/mutations/identity.mutation";
import { BaseProvider } from "./base.provider";
import { CacheEvaluation } from '../cache/cache-evaluation.interface';
import { Session } from '../schemas/session.schema';

export abstract class IdentityProvider<
  T extends Identity = Identity,
  Q extends IdentityQuery = IdentityQuery,
  M extends IdentityMutation = IdentityMutation
> extends BaseProvider<T, Q, M> {
  
  protected override generateCacheKey(_query: Q, session: Session): string {
    const providerName = this.constructor.name.toLowerCase();
    const userId = session.identity?.id;
    const key = userId 
      ? `${providerName}:identity:${userId}`
      : `${providerName}:identity:anonymous`;
    
    return key;
  }
  
  protected override getInvalidationKeys(_mutation: M, session: Session): string[] {
    const providerName = this.constructor.name.toLowerCase();
    const keys: string[] = [];
    
    // Identity mutations invalidate user's identity cache
    const userId = session.identity?.id;
    if (userId) {
      keys.push(`${providerName}:identity:${userId}`);
    }
    
    return keys;
  }
  
  protected override getCacheEvaluation(query: Q, session: Session): CacheEvaluation {
    const key = this.generateCacheKey(query, session);
    const ttl = this.getCacheTTL(query);
    
    // Only cache profiles for authenticated users
    const canCache = !!session.identity?.id;
    
    return {
      key,
      cacheDurationInSeconds: ttl,
      canCache
    };
  }
  
  protected override getCacheTTL(_query: Q): number {
    // User profiles don't change often - 3 minutes
    return 180;
  }
}