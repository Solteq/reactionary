import {
  type Identity,
  type IdentityMutationLogin,
  type IdentityMutationLogout,
  type IdentityMutationRegister,
  type IdentityQuerySelf,
  type RequestContext,
  type Cache,
  IdentityProvider,
  Reactionary,
  IdentityQuerySelfSchema,
  IdentitySchema,
  IdentityMutationRegisterSchema,
  IdentityMutationLoginSchema,
  IdentityMutationLogoutSchema,
  type AnonymousIdentity,
  type RegisteredIdentity,
  type Result,
  success,
} from '@reactionary/core';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type z from 'zod';
import type { MedusaClient } from '../core/client.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:medusa:identity');

export class MedusaIdentityProvider extends IdentityProvider {
  protected config: MedusaConfiguration;
  protected client: MedusaClient;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    client: MedusaClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
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
    _payload: IdentityQuerySelf
  ): Promise<Result<Identity>> {
    try {
      const medusaClient = await this.client.getClient();
      const token = await medusaClient.client.getToken();

      if (!token) {
        debug('No active session token found, returning anonymous identity');
        return success(this.createAnonymousIdentity());
      }

      // Try to fetch customer details to verify authentication
      const customerResponse = await medusaClient.store.customer.retrieve();

      if (customerResponse.customer) {
        debug('Customer authenticated:', customerResponse.customer.email);
        return success({
          id: {
            userId: customerResponse.customer.id,
          },
          type: 'Registered',
        } satisfies RegisteredIdentity);
      }

      return success(this.createAnonymousIdentity());
    } catch (error) {
      debug('getSelf failed, returning anonymous identity:', error);
      return success(this.createAnonymousIdentity());
    }
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(payload: IdentityMutationLogin): Promise<Result<Identity>> {
    debug('Attempting login for user:', payload.username);
    const identity = await this.client.login(
      payload.username,
      payload.password,
      this.context
    ) satisfies Identity;

    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationLogoutSchema,
    outputSchema: IdentitySchema,
  })
  public override async logout(_payload: IdentityMutationLogout): Promise<Result<Identity>> {
    debug('Logging out user');
    const identity = await this.client.logout(this.context);

    return success(identity);
  }

  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister
  ): Promise<Result<Identity>> {
    debug('Registering new user:', payload.username);

    // Extract first and last name from username or use defaults
    // In a real implementation, you might want to add firstName/lastName to the schema
    const nameParts = payload.username.split('.');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'Account';

    const identity = await this.client.register(
      payload.username, // Using username as email
      payload.password,
      firstName,
      lastName,
      this.context
    );

    return success(identity);
  }
}
