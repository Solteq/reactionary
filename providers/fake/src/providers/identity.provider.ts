import {
  type Identity,
  type IdentityQuerySelf,
  type IdentityMutationLogin,
  type IdentityMutationLogout,
  type RequestContext,
  type Cache,
  IdentityProvider,
  type IdentityMutationRegister,
  type AnonymousIdentity,
  type RegisteredIdentity,
  Reactionary,
  IdentityMutationRegisterSchema,
  IdentitySchema,
  IdentityMutationLogoutSchema,
  IdentityMutationLoginSchema,
  IdentityQuerySelfSchema,
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeIdentityProvider extends IdentityProvider {
  protected config: FakeConfiguration;
  private currentIdentity: Identity | null = null;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema
  })
  public override async getSelf(
    _payload: IdentityQuerySelf
  ): Promise<Identity> {
    if (!this.currentIdentity) {
      const model = {
        type: 'Anonymous',
        meta: {
          cache: {
            hit: false,
            key: 'anonymous',
          },
          placeholder: false,
        },
      } satisfies AnonymousIdentity;

      this.currentIdentity = model;
    }

    return this.currentIdentity;
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema
  })
  public override async login(
    payload: IdentityMutationLogin
  ): Promise<Identity> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const model = {
      type: 'Registered',
      id: {
        userId: generator.string.alphanumeric(32),
      },
      meta: {
        cache: {
          hit: false,
          key: payload.username,
        },
        placeholder: false,
      },
    } satisfies RegisteredIdentity;

    this.currentIdentity = model;

    return this.currentIdentity;
  }

  @Reactionary({
    inputSchema: IdentityMutationLogoutSchema,
    outputSchema: IdentitySchema
  })
  public override async logout(
    _payload: IdentityMutationLogout
  ): Promise<Identity> {
    const model = {
      type: 'Anonymous',
      meta: {
        cache: {
          hit: false,
          key: 'anonymous',
        },
        placeholder: false,
      },
    } satisfies AnonymousIdentity;

    this.currentIdentity = model;
    return this.currentIdentity;
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema
  })
  public override register(payload: IdentityMutationRegister): Promise<Identity> {
    throw new Error('Method not implemented.');
  }
}
