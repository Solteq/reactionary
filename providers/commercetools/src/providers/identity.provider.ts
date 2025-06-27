import {
  Identity,
  IdentityMutation,
  IdentityMutationLogin,
  IdentityProvider,
  IdentityQuery,
  Session,
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import z from 'zod';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsIdentityProvider<
  T extends Identity = Identity,
  Q extends IdentityQuery = IdentityQuery,
  M extends IdentityMutation = IdentityMutation
> extends IdentityProvider<T, Q, M> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    querySchema: z.ZodType<Q, Q>,
    mutationSchema: z.ZodType<M, M>
  ) {
    super(schema, querySchema, mutationSchema);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const results = [];

    for (const query of queries) {
      const result = await this.get(session);

      results.push(result);
    }

    return results;
  }

  protected override async process(
    mutations: M[],
    session: Session
  ): Promise<T> {
    let result = this.newModel();

    for (const mutation of mutations) {
      switch (mutation.mutation) {
        case 'login':
          result = await this.login(mutation, session);
          break;
        case 'logout':
          result = await this.logout(session);
          break;
      }
    }

    return result;
  }

  protected async get(session: Session): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const base = this.newModel();

    if (session.identity.token) {
      const remote = await client.introspect(session.identity.token);

      if (remote.active) {
        const current = this.schema.safeParse(session.identity);

        if (current.success) {
          return current.data;
        }
      }
    }

    session.identity = base;

    return base;
  }

  protected async login(
    payload: IdentityMutationLogin,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const remote = await client.login(payload.username, payload.password);
    const base = this.newModel();

    if (remote && remote.access_token) {
      base.issued = new Date();
      base.expiry = new Date();
      base.expiry.setSeconds(base.expiry.getSeconds() + remote.expires_in);
      base.id = this.extractCustomerIdFromScopes(remote.scope);
      base.token = remote.access_token;
      base.type = 'Registered';
    }

    // TODO: error handling

    session.identity = base;

    return base;
  }

  protected async logout(session: Session): Promise<T> {
    const client = new CommercetoolsClient(this.config);
    const base = this.newModel();

    if (session.identity.token) {
      const remote = await client.logout(session.identity.token);

      // TODO: error handling
    }

    session.identity = base;

    return base;
  }

  protected extractCustomerIdFromScopes(scopes: string) {
    const scopeList = scopes.split(' ');
    const customerScope = scopeList.find((x) => x.startsWith('customer_id'));
    const id = customerScope?.split(':')[1];

    return id || '';
  }
}
