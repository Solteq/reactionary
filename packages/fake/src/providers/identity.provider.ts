import {
  type AnonymousIdentity,
  type Cache,
  type Identity,
  type IdentityFactory,
  type IdentityFactoryOutput,
  type IdentityFactoryWithOutput,
  type IdentityMutationLogin,
  IdentityMutationLoginSchema,
  type IdentityMutationLogout,
  IdentityMutationLogoutSchema,
  type IdentityMutationRegister,
  IdentityMutationRegisterSchema,
  type IdentityQuerySelf,
  IdentityQuerySelfSchema,
  IdentityProvider,
  IdentitySchema,
  type RegisteredIdentity,
  type RequestContext,
  type Result,
  Reactionary,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import type { FakeIdentityFactory } from '../factories/identity/identity.factory.js';

export class FakeIdentityProvider<
  TFactory extends IdentityFactory = FakeIdentityFactory,
> extends IdentityProvider<IdentityFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: IdentityFactoryWithOutput<TFactory>;
  private currentIdentity: Identity | null = null;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: IdentityFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(
    _payload: IdentityQuerySelf,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    if (!this.currentIdentity) {
      this.currentIdentity = {
        type: 'Anonymous',
      } satisfies AnonymousIdentity;
    }

    return success(this.factory.parseIdentity(this.context, this.currentIdentity));
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(
    _payload: IdentityMutationLogin,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    this.currentIdentity = {
      type: 'Registered',
      id: {
        userId: generator.string.alphanumeric(32),
      },
    } satisfies RegisteredIdentity;

    return success(this.factory.parseIdentity(this.context, this.currentIdentity));
  }

  @Reactionary({
    inputSchema: IdentityMutationLogoutSchema,
    outputSchema: IdentitySchema,
  })
  public override async logout(
    _payload: IdentityMutationLogout,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    this.currentIdentity = {
      type: 'Anonymous',
    } satisfies AnonymousIdentity;

    return success(this.factory.parseIdentity(this.context, this.currentIdentity));
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override register(
    _payload: IdentityMutationRegister,
  ): Promise<Result<IdentityFactoryOutput<TFactory>>> {
    throw new Error('Method not implemented.');
  }
}
