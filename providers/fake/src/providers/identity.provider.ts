import {
  Identity,
  IdentityProvider,
  IdentityQuerySelf,
  IdentityMutationLogin,
  IdentityMutationLogout,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { base, en, Faker } from '@faker-js/faker';

export class FakeIdentityProvider<
  T extends Identity = Identity
> extends IdentityProvider<T> {
  protected config: FakeConfiguration;
  private currentIdentity: T | null = null;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: any) {
    super(schema, cache);

    this.config = config;
  }

  public override async getSelf(
    payload: IdentityQuerySelf,
    session: Session
  ): Promise<T> {
    if (!this.currentIdentity) {
      const model = this.newModel();
      Object.assign(model, {
        id: 'anonymous',
        type: 'Anonymous',
        issued: new Date(),
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        meta: {
          cache: {
            hit: false,
            key: 'anonymous',
          },
          placeholder: false,
        },
      });
      this.currentIdentity = this.assert(model);
    }

    return this.currentIdentity;
  }

  public override async login(
    payload: IdentityMutationLogin,
    session: Session
  ): Promise<T> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const model = this.newModel();
    Object.assign(model, {
      id: generator.string.uuid(),
      type: 'Registered',
      token: generator.string.alphanumeric(32),
      issued: new Date(),
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      meta: {
        cache: {
          hit: false,
          key: payload.username,
        },
        placeholder: false,
      },
    });
    
    this.currentIdentity = this.assert(model);
    return this.currentIdentity;
  }

  public override async logout(
    payload: IdentityMutationLogout,
    session: Session
  ): Promise<T> {
    const model = this.newModel();
    Object.assign(model, {
      id: 'anonymous',
      type: 'Anonymous',
      issued: new Date(),
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      meta: {
        cache: {
          hit: false,
          key: 'anonymous',
        },
        placeholder: false,
      },
    });
    
    this.currentIdentity = this.assert(model);
    return this.currentIdentity;
  }
}