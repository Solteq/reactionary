import {
  type Identity,
  type IdentityMutationLogin,
  type IdentityQuerySelf,
  type Session, type RequestContext,
  type Cache,
  IdentityProvider,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema';
import type z from 'zod';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsIdentityProvider<
  T extends Identity = Identity
> extends IdentityProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  public override async getSelf(
    payload: IdentityQuerySelf,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const base = this.newModel();

    if (reqCtx.identity.token) {
      const remote = await client.introspect(reqCtx.identity.token);

      if (remote.active) {
        const current = this.schema.safeParse(reqCtx.identity);

        if (current.success) {
          current.data.meta = {
            cache: { hit: false, key: current.data.id.userId || 'anonymous' },
            placeholder: false
          };
          return current.data;
        }
      }
    }

    base.meta = {
      cache: { hit: false, key: 'anonymous' },
      placeholder: false
    };
    reqCtx.identity = base;

    return this.assert(base);
  }

  public override async login(
    payload: IdentityMutationLogin,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const remote = await client.login(payload.username, payload.password);
    const base = this.newModel();

    if (remote && remote.access_token) {
      base.id = { userId: this.extractCustomerIdFromScopes(remote.scope) };
      base.issued = new Date();
      base.expiry = new Date();
      base.expiry.setSeconds(base.expiry.getSeconds() + remote.expires_in);
      base.token = remote.access_token;
      base.refresh_token = remote.refresh_token;
      base.type = 'Registered';
    }

    base.meta = {
      cache: { hit: false, key: base.id.userId || 'anonymous' },
      placeholder: false
    };

    reqCtx.identity = base;

    return this.assert(base);
  }

  public override async logout(
    payload: Record<string, never>,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const base = this.newModel();

    if (reqCtx.identity.token) {
      await client.logout(reqCtx.identity.token);
    }

    base.meta = {
      cache: { hit: false, key: 'anonymous' },
      placeholder: false
    };
    reqCtx.identity = base;

    return this.assert(base);
  }

  protected extractCustomerIdFromScopes(scopes: string) {
    const scopeList = scopes.split(' ');
    const customerScope = scopeList.find((x) => x.startsWith('customer_id'));
    const id = customerScope?.split(':')[1];

    return id || '';
  }
}
