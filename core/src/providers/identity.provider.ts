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
  
  protected override getCacheEvaluation(_query: Q, session: Session): CacheEvaluation {
    const providerName = this.constructor.name.toLowerCase();
    const userId = session.identity?.id;
    const key = userId 
      ? `${providerName}:identity:${userId}`
      : `${providerName}:identity:anonymous`;
    
    return {
      key,
      cacheDurationInSeconds: 0,
      canCache: false
    };
  }
}