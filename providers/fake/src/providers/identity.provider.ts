import {
  Identity,
  IdentityLoginPayload,
  IdentityProvider,
  Session,
} from '@reactionary/core';
import { FakeConfiguration } from '../schema/configuration.schema';
import z from 'zod';
import { faker } from '@faker-js/faker';

export class FakeIdentityProvider<
  Q extends Identity
> extends IdentityProvider<Q> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<Q>) {
    super(schema);

    this.config = config;
  }

  public override async login(
    payload: IdentityLoginPayload,
    session: Session
  ): Promise<Q> {
    const base = this.base();

    base.id = faker.string.uuid();
    base.token = faker.string.uuid();
    base.issued = faker.date.recent();
    base.issued = faker.date.soon();
    base.type = 'Registered';

    return base;
  }

  public override async get(session: Session): Promise<Q> {
    const base = this.schema.parse(session.identity);

    return base;
  }

  public override async logout(session: Session): Promise<Q> {
    const base = this.base();

    session.identity = base;

    return base;
  }
}
