import type { TokenCache, TokenCacheOptions, TokenStore } from "@commercetools/ts-client";
import type { RequestContext } from "@reactionary/core";
import { CommercetoolsSessionSchema } from "../schema/session.schema.js";

export const PROVIDER_COMMERCETOOLS_SESSION_KEY = 'PROVIDER_COMMERCETOOLS';
export class RequestContextTokenCache implements TokenCache {
  constructor(protected context: RequestContext) {}

  public async get(
    tokenCacheOptions?: TokenCacheOptions
  ): Promise<TokenStore | undefined> {
    const session = CommercetoolsSessionSchema.parse(
      this.context.session[PROVIDER_COMMERCETOOLS_SESSION_KEY] || {}
    );

    if (!session) {
      return {
        refreshToken: undefined,
        token: '',
        expirationTime: new Date().getTime(),
      };
    }

    return {
      refreshToken: session.refreshToken,
      token: session.token,
      expirationTime: session.expirationTime,
    };
  }

  public async set(
    cache: TokenStore,
    tokenCacheOptions?: TokenCacheOptions
  ): Promise<void> {
    const session = CommercetoolsSessionSchema.parse(
      this.context.session[PROVIDER_COMMERCETOOLS_SESSION_KEY] || {}
    );

    this.context.session[PROVIDER_COMMERCETOOLS_SESSION_KEY] = session;

    session.refreshToken = cache.refreshToken;
    session.token = cache.token;
    session.expirationTime = cache.expirationTime;
  }
}
