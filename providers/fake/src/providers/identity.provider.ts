import {
  type Identity,
  type IdentityQuerySelf,
  type IdentityMutationLogin,
  type IdentityMutationLogout,
  type RequestContext,
  type Cache,
  IdentityProvider,
  type IdentityMutationRegister,
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeIdentityProvider<
  T extends Identity = Identity
> extends IdentityProvider<T> {
  protected config: FakeConfiguration;
  private currentIdentity: T | null = null;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async getSelf(
    _payload: IdentityQuerySelf,
    _reqCtx: RequestContext
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
    _reqCtx: RequestContext
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
    _payload: IdentityMutationLogout,
    _reqCtx: RequestContext
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

  public override register(
    payload: IdentityMutationRegister,
    reqCtx: RequestContext
  ): Promise<T> {
    throw new Error('Method not implemented.');
  }
}
