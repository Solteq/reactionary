import  * as Medusa  from '@medusajs/js-sdk';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  AnonymousIdentitySchema,
  GuestIdentitySchema,
  RegisteredIdentitySchema,
  type RequestContext,
} from '@reactionary/core';
import createDebug from 'debug';

const debug = createDebug('medusa:debug');

export interface MedusaAuthToken {
  token: string;
  expires_at?: Date;
}

export class RequestContextTokenStore {
  constructor(protected context: RequestContext) {}

  public async getToken(): Promise<string | undefined> {
    const identity = this.context.identity;
    return identity.token;
  }

  public async setToken(token: string, expiresAt?: Date): Promise<void> {
    const identity = this.context.identity;
    identity.token = token;
    if (expiresAt) {
      identity.expiry = expiresAt;
    }
  }

  public async clearToken(): Promise<void> {
    const identity = this.context.identity;
    identity.token = undefined;
    identity.refresh_token = undefined;
    identity.expiry = new Date(0);
  }
}

export class MedusaClient {
  protected config: MedusaConfiguration;
  protected client: Medusa;

  constructor(config: MedusaConfiguration) {
    this.config = config;
    this.client = new Medusa({
      baseUrl: this.config.apiUrl,
      publishableKey: this.config.publishable_key,
      debug: debug.enabled
    });
  }

  public async getClient(reqCtx: RequestContext): Promise<Medusa> {
    return this.createAuthenticatedClient(reqCtx);
  }

  public async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    reqCtx: RequestContext
  ) {
    try {
      // Create customer account
      await this.client.store.customers.register(
        "customer",
        "emailpass",
        {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });

      // Automatically log in after registration
      const identity = await this.login(email, password, reqCtx);

      return identity;
    } catch (error) {
      debug('Registration failed:', error);
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async login(
    email: string,
    password: string,
    reqCtx: RequestContext
  ) {
    try {
      const tokenStore = new RequestContextTokenStore(reqCtx);

      // Authenticate with Medusa
      const authResult = await this.client.auth.login({
        email,
        password,
      });

      if (authResult.token) {
        await tokenStore.setToken(authResult.token);
      }

      // Get customer details
      const customerResponse = await this.client.auth.getSession();

      if (customerResponse.customer) {
        reqCtx.identity = RegisteredIdentitySchema.parse({
          ...reqCtx.identity,
          type: 'Registered',
          logonId: email,
          id: {
            userId: customerResponse.customer.id,
          },
          token: authResult.token,
        });
      }

      return reqCtx.identity;
    } catch (error) {
      debug('Login failed:', error);
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async logout(reqCtx: RequestContext) {
    try {
      const tokenStore = new RequestContextTokenStore(reqCtx);

      // Clear the session on Medusa side
      if (reqCtx.identity.token) {
        await this.client.auth.logout();
      }

      // Clear local token storage
      await tokenStore.clearToken();

      // Reset to anonymous identity
      reqCtx.identity = AnonymousIdentitySchema.parse({});

      return reqCtx.identity;
    } catch (error) {
      debug('Logout failed:', error);
      // Even if logout fails on server side, clear local session
      const tokenStore = new RequestContextTokenStore(reqCtx);
      await tokenStore.clearToken();
      reqCtx.identity = AnonymousIdentitySchema.parse({});
      return reqCtx.identity;
    }
  }

  public async refreshToken(reqCtx: RequestContext): Promise<boolean> {
    try {
      const tokenStore = new RequestContextTokenStore(reqCtx);

      // Try to refresh the session
      const sessionResponse = await this.client.auth.getSession();

      if (sessionResponse.customer) {
        // Session is still valid
        return true;
      }

      // Session expired, clear tokens
      await tokenStore.clearToken();
      reqCtx.identity = AnonymousIdentitySchema.parse({});
      return false;
    } catch (error) {
      debug('Token refresh failed:', error);
      const tokenStore = new RequestContextTokenStore(reqCtx);
      await tokenStore.clearToken();
      reqCtx.identity = AnonymousIdentitySchema.parse({});
      return false;
    }
  }

  protected async createAuthenticatedClient(reqCtx: RequestContext): Promise<Medusa> {
    const tokenStore = new RequestContextTokenStore(reqCtx);

    // Ensure we have some form of identity
    if (reqCtx.identity.type === 'Anonymous') {
      reqCtx.identity = GuestIdentitySchema.parse({
        id: {
          userId: globalThis.crypto.randomUUID().toString(),
        },
        type: 'Guest',
      });
    }

    const identity = reqCtx.identity;

    // Create a client instance
    const authenticatedClient = new Medusa({
      baseUrl: this.config.apiUrl,
      publishableKey: this.config.publishable_key,
      debug: this.config.debug || debug.enabled,
    });

    // If we have a token, set it for authenticated requests
    if (identity.token) {
      // Set the authorization header for authenticated requests
      authenticatedClient.client.setClientHeaders({
        'Authorization': `Bearer ${identity.token}`,
      });

      // Verify the token is still valid
      try {
        await authenticatedClient.auth.getSession();
      } catch (error) {
        debug('Token validation failed, clearing token:', error);
        await tokenStore.clearToken();
        // Remove authorization header for guest requests
        authenticatedClient.client.setClientHeaders({});
      }
    }

    return authenticatedClient;
  }

  public async getCustomer(reqCtx: RequestContext) {
    const client = await this.getClient(reqCtx);

    if (reqCtx.identity.type === 'Registered' && reqCtx.identity.token) {
      try {
        const response = await client.auth.getSession();
        return response.customer;
      } catch (error) {
        debug('Failed to get customer:', error);
        return null;
      }
    }

    return null;
  }

  public async updateCustomer(
    updates: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      metadata?: Record<string, unknown>;
    },
    reqCtx: RequestContext
  ) {
    const client = await this.getClient(reqCtx);

    if (reqCtx.identity.type === 'Registered' && reqCtx.identity.id.userId) {
      try {
        const response = await client.store.customer.update(updates);
        return response.customer;
      } catch (error) {
        debug('Failed to update customer:', error);
        throw new Error(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error('Customer must be logged in to update profile');
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string,
    reqCtx: RequestContext
  ) {
    const client = await this.getClient(reqCtx);

    if (reqCtx.identity.type === 'Registered') {
      try {
        // First verify current password by attempting to login
        if (!reqCtx.identity.logonId) {
          throw new Error('No login ID available');
        }

        await this.client.auth.login({
          email: reqCtx.identity.logonId,
          password: currentPassword,
        });

        // Update password
        await client.store.customer.update({
          password: newPassword,
        });

        return true;
      } catch (error) {
        debug('Failed to change password:', error);
        throw new Error(`Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error('Customer must be logged in to change password');
  }

  public async requestPasswordReset(email: string) {
    try {
      await this.client.auth.resetPassword({
        email,
      });
      return true;
    } catch (error) {
      debug('Failed to request password reset:', error);
      throw new Error(`Failed to request password reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
