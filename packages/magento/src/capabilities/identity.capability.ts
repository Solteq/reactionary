import {
  type Identity,
  type IdentityMutationLogin,
  type IdentityMutationLogout,
  type IdentityMutationRegister,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  IdentityCapability,
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
  success,
} from '@reactionary/core';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:identity');

export class MagentoIdentityCapability extends IdentityCapability {
  protected config: MagentoConfiguration;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
  ) {
    super(cache, context);
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

    // The register schema is loose: extra keys (e.g. `dob`,
    // `custom_attributes`) are forwarded to the Magento customer entity.
    // `username` is mapped to `email` and `password` is sent alongside the
    // customer object, so neither belongs inside it.
    const { username, password, ...rest } = payload;
    const { firstname, lastname, ...extra }: Record<string, unknown> = rest;
    const customer = {
      ...extra,
      email: username,
      firstname: firstname || 'User',
      lastname: lastname || 'Account',
    };

    await this.magentoApi.register(customer, password);

    return this.login({ username, password });
  }
}
