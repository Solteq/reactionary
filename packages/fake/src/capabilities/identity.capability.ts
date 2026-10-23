import {
  type AnonymousIdentity,
  type Cache,
  type ExternalLoginRedirect,
  ExternalLoginRedirectSchema,
  type IdentityConflictError,
  type IdentityMutationCompleteExternalLogin,
  IdentityMutationCompleteExternalLoginSchema,
  type IdentityMutationStartExternalLogin,
  IdentityMutationStartExternalLoginSchema,
  type IdentityProvider,
  IdentityProviderSchema,
  type IdentityQueryProviders,
  IdentityQueryProvidersSchema,
  PASSWORD_IDENTITY_PROVIDER,
  error,
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
  IdentityCapability,
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

export class FakeIdentityCapability<
  TFactory extends IdentityFactory = FakeIdentityFactory,
> extends IdentityCapability<IdentityFactoryOutput<TFactory>> {
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

  @Reactionary({
    inputSchema: IdentityQueryProvidersSchema,
    outputSchema: IdentityProviderSchema.array(),
  })
  public override async listProviders(
    _payload: IdentityQueryProviders,
  ): Promise<Result<IdentityProvider[]>> {
    return success([
      PASSWORD_IDENTITY_PROVIDER,
      IdentityProviderSchema.parse({
        identifier: { key: 'fake-oidc' },
        displayName: 'Fake OIDC',
        flow: 'redirect',
      }),
    ]);
  }

  @Reactionary({
    inputSchema: IdentityMutationStartExternalLoginSchema,
    outputSchema: ExternalLoginRedirectSchema,
  })
  public override async startExternalLogin(
    payload: IdentityMutationStartExternalLogin,
  ): Promise<Result<ExternalLoginRedirect>> {
    const state = new Faker({ locale: [en, base] }).string.alphanumeric(32);
    this.setPendingExternalLogin(payload.provider.key, state);

    const location = new URL(payload.callbackUrl);
    location.searchParams.set('code', 'fake-code');
    location.searchParams.set('state', state);
    return success({ location: location.toString() });
  }

  @Reactionary({
    inputSchema: IdentityMutationCompleteExternalLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async completeExternalLogin(
    payload: IdentityMutationCompleteExternalLogin,
  ): Promise<Result<IdentityFactoryOutput<TFactory>, IdentityConflictError>> {
    if (!this.consumePendingExternalLogin(payload.provider.key, payload.callbackParameters['state'])) {
      return error({ type: 'InvalidInput', error: 'The login was not started in this session, or has expired' });
    }
    if (payload.callbackParameters['code'] === 'conflict') {
      return error({ type: 'IdentityConflict', message: 'An account with this email already exists' });
    }

    this.currentIdentity = {
      type: 'Registered',
      id: { userId: `external-${payload.provider.key}` },
    } satisfies RegisteredIdentity;
    const identity = this.factory.parseIdentity(this.context, this.currentIdentity);
    this.updateIdentityContext(identity);
    return success(identity);
  }
}
