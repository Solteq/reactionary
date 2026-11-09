import {
  type Identity,
  type IdentityConflictError,
  type IdentityMutationLogin,
  type IdentityMutationLogout,
  type IdentityMutationRegister,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  Reactionary,
  IdentityQuerySelfSchema,
  IdentitySchema,
  IdentityMutationRegisterSchema,
  IdentityMutationLoginSchema,
  IdentityMutationLogoutSchema,
  type AnonymousIdentity,
  type RegisteredIdentity,
  type GuestIdentity,
  type Result,
  error,
  externalLoginResult,
  profileFromOidcClaims,
  success,
} from '@reactionary/core';
import { OidcIdentityCapability, type ExchangeExternalIdentityInput } from '@reactionary/oidc';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:identity');

export class MagentoIdentityCapability extends OidcIdentityCapability {
  protected config: MagentoConfiguration;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
  ) {
    super(cache, context, config.externalIdentityProviders);
    this.config = config;
  }

  protected createAnonymousIdentity(): AnonymousIdentity {
    return {
      type: 'Anonymous',
    };
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(
    _payload: IdentityQuerySelf,
  ): Promise<Result<Identity>> {
    const customerToken = await this.magentoApi.getCustomerToken();

    if (customerToken) {
      try {
        const client = await this.magentoApi.getClient();
        const me = await client.store.customer.me();

        const identity = {
          id: {
            userId: String(me.id),
          },
          type: 'Registered',
        } satisfies RegisteredIdentity;

        this.updateIdentityContext(identity);
        return success(identity);
      } catch (err) {
        debug('getSelf: customer token present but /me failed:', err);
      }
    }

    const activeCartId = await this.magentoApi.getActiveCartId();
    if (activeCartId) {
      debug('Active cart found without customer token, treating as guest');
      const identity = {
        type: 'Guest',
        id: {
          userId: 'guest',
        },
      } satisfies GuestIdentity;
      this.updateIdentityContext(identity);
      return success(identity);
    }

    const identity = this.createAnonymousIdentity();
    this.updateIdentityContext(identity);
    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(
    payload: IdentityMutationLogin,
  ): Promise<Result<Identity>> {
    debug('Attempting login for user:', payload.username);
    await this.magentoApi.login(payload.username, payload.password);

    return this.getSelf({});
  }

  @Reactionary({
    inputSchema: IdentityMutationLogoutSchema,
    outputSchema: IdentitySchema,
  })
  public override async logout(
    _payload: IdentityMutationLogout,
  ): Promise<Result<Identity>> {
    debug('Logging out user');
    await this.magentoApi.logout();

    const identity = this.createAnonymousIdentity();
    this.updateIdentityContext(identity);
    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister,
  ): Promise<Result<Identity>> {
    debug('Registering new user:', payload.username);

    const customer = {
      email: payload.username,
      firstname: (payload as Record<string, unknown>)['firstname'] || 'User',
      lastname: (payload as Record<string, unknown>)['lastname'] || 'Account',
    };

    await this.magentoApi.register(customer, payload.password);

    return this.login({
      username: payload.username,
      password: payload.password,
    });
  }

  /**
   * Stock Magento has no external login. Once the shared OpenID Connect client has verified the identity, this
   * finds or creates the customer by verified email (the pattern in Adobe's social login guide) and issues a
   * customer token. An existing account with the same email is signed in, which is only appropriate for identity
   * providers the shop owner trusts: that is what the configured provider list is.
   */
  protected override async exchangeExternalIdentity(
    input: ExchangeExternalIdentityInput,
  ): Promise<Result<Identity, IdentityConflictError>> {
    // Magento has no email verification status to store, so emailVerified is only reported on the identity
    const { email } = profileFromOidcClaims(input.claims);
    if (!email) {
      return error({ type: 'InvalidInput', error: 'The identity provider did not return an email address' });
    }

    const { isNewCustomer } = await this.magentoApi.signInExternalIdentity({ email, ...namesFromClaims(input.claims) });

    const me = await this.magentoApi.getMe();
    return success({
      type: 'Registered',
      id: { userId: String(me.id) },
      externalLogin: externalLoginResult(input.claims, isNewCustomer),
    } satisfies RegisteredIdentity);
  }
}

/** Magento requires both names; fall back to the defaults register() uses. */
function namesFromClaims(claims: ExchangeExternalIdentityInput['claims']): { firstName: string; lastName: string } {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
  const given = text(claims['given_name']);
  const family = text(claims['family_name']);
  if (given || family) {
    return { firstName: given ?? 'User', lastName: family ?? 'Account' };
  }
  const [first, ...rest] = (text(claims['name']) ?? '').split(' ').filter(Boolean);
  return { firstName: first ?? 'User', lastName: rest.join(' ') || 'Account' };
}
