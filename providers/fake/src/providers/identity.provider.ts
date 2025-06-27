import {
  Identity,
  IdentityMutation,
  IdentityMutationLogin,
  IdentityProvider,
  IdentityQuery,
  Session,
} from '@reactionary/core';
import { FakeConfiguration } from '../schema/configuration.schema';
import z from 'zod';
import { faker } from '@faker-js/faker';

export class FakeIdentityProvider<
  T extends Identity = Identity,
  Q extends IdentityQuery = IdentityQuery,
  M extends IdentityMutation = IdentityMutation
> extends IdentityProvider<T, Q, M> {
  protected config: FakeConfiguration;

  constructor(
    config: FakeConfiguration,
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

  protected async login(
    payload: IdentityMutationLogin,
    session: Session
  ): Promise<T> {
    const base = this.newModel();

    base.id = faker.string.uuid();
    base.token = faker.string.uuid();
    base.issued = faker.date.recent();
    base.issued = faker.date.soon();
    base.type = 'Registered';

    return base;
  }

  protected async get(session: Session): Promise<T> {
    const base = this.schema.parse(session.identity);

    return base;
  }

  protected async logout(session: Session): Promise<T> {
    const base = this.newModel();

    session.identity = base;

    return base;
  }
}
