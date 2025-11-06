
import  {  Admin,  Auth,  Client,  type Config,  Store }  from '@medusajs/js-sdk';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  AnonymousIdentitySchema,
  GuestIdentitySchema,
  RegisteredIdentitySchema,
  type RequestContext,
} from '@reactionary/core';
import createDebug from 'debug';
const debug = createDebug('reactionary:medusa');

export interface MedusaAuthToken {
  token: string;
  expires_at?: Date;
}

export class RequestContextTokenStore {
  constructor(protected context: RequestContext) {}

  public async getToken(): Promise<string | undefined> {
    const session = this.context.session['MEDUSA_PROVIDER'] || {};
    return session.token;
  }

  public async setToken(token: string, expiresAt?: Date): Promise<void> {
    const session = this.context.session['MEDUSA_PROVIDER'] || {};
    session.token = token;
    if (expiresAt) {
      session.expiry = expiresAt;
    }
  }

  public async clearToken(): Promise<void> {
    this.context.session['MEDUSA_PROVIDER'] = {};
  }
}

class Medusa {
  public client: Client

  public admin: Admin
  public store: Store
  public auth: Auth

  constructor(config: Config) {
    this.client = new Client(config)

    this.admin = new Admin(this.client)
    this.store = new Store(this.client)
    this.auth = new Auth(this.client, config)
  }
}

export class MedusaAdminClient {
  protected config: MedusaConfiguration;
  protected client: Medusa;

  constructor(config: MedusaConfiguration) {
    this.config = config;
    console.log('MedusaAdminClient config:', this.config, 'Debug enabled:', debug.enabled);
    this.client = new Medusa({
      baseUrl: this.config.apiUrl,
      apiKey: this.config.adminApiKey,
      debug: true
    });
  }

  public async getClient(reqCtx: RequestContext): Promise<Medusa> {
    return this.client;
  }
}


export class MedusaClient {
  protected config: MedusaConfiguration;
  protected client: Medusa;

  constructor(config: MedusaConfiguration) {
    this.config = config;
    console.log('MedusaClient config:', this.config, 'Debug enabled:', debug.enabled);
    this.client = new Medusa({
      baseUrl: this.config.apiUrl,
      publishableKey: this.config.publishable_key,
      debug: true
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
      await this.client.auth.register(
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
      const authResult = await this.client.auth.login("customer", "emailpass", {
        email,
        password,
      });

      const token = await this.client.client.getToken();
      if (token) {
        await tokenStore.setToken(token);
      }

      // Get customer details
      const customerResponse = await this.client.store.customer.retrieve();

      if (customerResponse.customer) {
         return RegisteredIdentitySchema.parse({
       });
      }

      return AnonymousIdentitySchema.parse({});
    } catch (error) {
      debug('Login failed:', error);
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async logout(reqCtx: RequestContext) {
    try {
      const tokenStore = new RequestContextTokenStore(reqCtx);
      const token = await tokenStore.getToken();

      // Clear the session on Medusa side
      if (token) {
        await this.client.auth.logout();
        await this.client.client.clearToken();
      }

      // Clear local token storage
      await tokenStore.clearToken();

      return AnonymousIdentitySchema.parse({});
    } catch (error) {
      debug('Logout failed:', error);
      // Even if logout fails on server side, clear local session
      const tokenStore = new RequestContextTokenStore(reqCtx);
      await tokenStore.clearToken();

      return AnonymousIdentitySchema.parse({})
    }
  }


  protected async createAuthenticatedClient(reqCtx: RequestContext): Promise<Medusa> {
    const tokenStore = new RequestContextTokenStore(reqCtx);
    const initialToken = await tokenStore.getToken();

    // Create a client instance
    const authenticatedClient = new Medusa({
      baseUrl: this.config.apiUrl,
      publishableKey: this.config.publishable_key,
      debug: debug.enabled,
    });

    // If we have a token, set it for authenticated requests
    if (initialToken) {
      // Set the authorization header for authenticated requests
      await authenticatedClient.client.setToken(initialToken);
      const token = await authenticatedClient.client.getToken()
      if (!token) {
        debug('Token validation failed, clearing token');
        await tokenStore.clearToken();
      }
    }

    return authenticatedClient;
  }

}
