import {
  Identity,
  IdentityMutationLogin,
  IdentityProvider,
  IdentityQuerySelf,
  Session,
  Cache,
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import z from 'zod';
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
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const base = this.newModel();

    if (session.identity.token) {
      const remote = await client.introspect(session.identity.token);

      if (remote.active) {
        const current = this.schema.safeParse(session.identity);

        if (current.success) {
          current.data.meta = {
            cache: { hit: false, key: session.identity.id.userId || 'anonymous' },
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
    session.identity = base;

    return this.assert(base);
  }

  public override async login(
    payload: IdentityMutationLogin,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const remote = await client.login(payload.username, payload.password);
    const base = this.newModel();

    if (remote && remote.access_token) {
      base.id = { userId: this.extractCustomerIdFromScopes(remote.scope) };

      base.keyring = base.keyring.filter(x => x.service !== 'commercetools');
      base.keyring.push({
        service: 'commercetools',
        token: remote.access_token,
        issued: new Date(),
        expiry: new Date(new Date().getTime() + 3600 * 1000),
      });
      base.issued = new Date();
      base.expiry = new Date();
      base.expiry.setSeconds(base.expiry.getSeconds() + remote.expires_in);
      base.token = remote.access_token;
      base.type = 'Registered';
    }

    base.meta = {
      cache: { hit: false, key: base.id.userId || 'anonymous' },
      placeholder: false
    };

    session.identity = base;

    return this.assert(base);
  }

  public override async logout(
    payload: Record<string, never>,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const base = this.newModel();

    if (session.identity.token) {
      await client.logout(session.identity.token);
    }

    base.meta = {
      cache: { hit: false, key: 'anonymous' },
      placeholder: false
    };
    session.identity = base;

    return this.assert(base);
  }

  protected extractCustomerIdFromScopes(scopes: string) {
    const scopeList = scopes.split(' ');
    const customerScope = scopeList.find((x) => x.startsWith('customer_id'));
    const id = customerScope?.split(':')[1];

    return id || '';
  }
}
