import { Admin, Auth, Client, type Config, Store } from '@medusajs/js-sdk';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  AnonymousIdentitySchema,
  GuestIdentitySchema,
  Reactionary,
  RegisteredIdentitySchema,
  type AnonymousIdentity,
  type Currency,
  type RegisteredIdentity,
  type RequestContext,
} from '@reactionary/core';
import createDebug from 'debug';
import {
  MedusaSessionSchema,
  type MedusaRegion,
  type MedusaSession,
} from '../index.js';
import type { StoreProduct } from '@medusajs/types';
const debug = createDebug('reactionary:medusa:client');

export const SESSION_KEY = 'MEDUSA_PROVIDER';

export interface MedusaAuthToken {
  token: string;
  expires_at?: Date;
}

export interface MedusaCustomStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class RequestContextTokenStore implements MedusaCustomStorage {
  constructor(protected context: RequestContext, public keyPrefix = '__x') {}

  getItem(key: string): Promise<string | null> {
    if (this.context.session[SESSION_KEY] === undefined) {
      this.context.session[SESSION_KEY] = {};
    }
    const retVal = this.context.session[SESSION_KEY]
      ? (this.context.session[SESSION_KEY] as MedusaSession)[this.keyPrefix + '_' + key] || null
      : null;
    if (debug.enabled) {
      debug(
        `Getting token item for key: ${this.keyPrefix + '_' + key} - Found: ${
          retVal ? 'Yes' : 'No'
        }`
      );
    }
    return Promise.resolve(retVal as any);
  }

  setItem(key: string, value: string): Promise<void> {
    if (this.context.session[SESSION_KEY] === undefined) {
      this.context.session[SESSION_KEY] = {};
    }
    if (debug.enabled) {
      // Never log the value itself: it is typically an auth JWT.
      debug(
        `Setting token item for key: ${
          this.keyPrefix + '_' + key
        } - Value: <redacted, ${value.length} chars>`
      );
    }
    (this.context.session[SESSION_KEY] as MedusaSession)[this.keyPrefix + '_' + key] = value;
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    if (this.context.session[SESSION_KEY] === undefined) {
      this.context.session[SESSION_KEY] = {};
    }
    if (debug.enabled) {
      debug(`Removing token item for key: ${this.keyPrefix + '_' + key}`);
    }
    delete (this.context.session[SESSION_KEY] as MedusaSession)[this.keyPrefix + '_' + key];
    return Promise.resolve();
  }
}


class Medusa {
  public client: Client;

  public admin: Admin;
  public store: Store;
  public auth: Auth;

  constructor(config: Config) {
    this.client = new Client(config);

    this.admin = new Admin(this.client);
    this.store = new Store(this.client);
    this.auth = new Auth(this.client, config);
  }

}

export class MedusaAdminAPI {
  protected config: MedusaConfiguration;
  protected client: Medusa;
  protected context: RequestContext;

  constructor(config: MedusaConfiguration, context: RequestContext) {
    this.config = config;
    this.context = context;
    this.client = new Medusa({
      baseUrl: this.config.apiUrl,
      apiKey: this.config.adminApiKey,
      debug: debug.enabled,
      globalHeaders: {
        'x-medusa-locale': this.context.languageContext.locale,
      }
    });
  }

  public async getClient(): Promise<Medusa> {
    return this.client;
  }
}

export class MedusaAPI {
  protected config: MedusaConfiguration;
  protected client: Promise<Medusa> | undefined;
  protected context: RequestContext;

  constructor(config: MedusaConfiguration, context: RequestContext) {
    this.config = config;
    this.context = context;
    this.client = undefined;
  }

  public async getActiveRegion() {
    const session = this.getSessionData();
    if (session.selectedRegion) {
      if (session.selectedRegion.currency_code === this.context.languageContext.currencyCode.toLowerCase()) {
        return session.selectedRegion;
      }
    }

    const regions = await (await this.getClient()).store.region.list();
    const allRegions: MedusaRegion[] = [];
    for (const region of regions.regions) {
      allRegions.push({
        id: region.id,
        name: region.name,
        currency_code: region.currency_code,
      });
    }
    const selectedRegion =
      allRegions.find(
        (r) =>
          r.currency_code ===
          this.context.languageContext.currencyCode.toLowerCase()
      ) || allRegions[0];
    this.context.languageContext.currencyCode = (
      selectedRegion || allRegions[0]
    ).currency_code.toUpperCase() as Currency;

    this.setSessionData({
      allRegions,
      selectedRegion: selectedRegion,
    });
    return selectedRegion;
  }


  public async getClient(): Promise<Medusa> {
    if (!this.client) {
      this.client = this.createAuthenticatedClient(this.context);
    }
    return await this.client;
  }

  public getSessionData(): MedusaSession {
    return this.context.session[SESSION_KEY]
      ? this.context.session[SESSION_KEY] as Partial<MedusaSession>
      : MedusaSessionSchema.parse({});
  }

  public setSessionData(sessionData: Partial<MedusaSession>): void {
    const existingData = this.context.session[SESSION_KEY] as Partial<MedusaSession>;

    this.context.session[SESSION_KEY] = {
      ...existingData,
      ...sessionData,
    };
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
      const client = await this.getClient();
      const tokenResponse = await client.auth.register(
        'customer',
        'emailpass',
        {
          email,
          password,
        }
      );

      const customer = await client.store.customer.create({
        email,
        first_name: firstName,
        last_name: lastName,
      });

      // Automatically log in after registration
      const identity = await this.login(email, password, reqCtx);

      return identity;
    } catch (error) {
      debug('Registration failed:', error);
      throw new Error(
        `Registration failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  public async login(email: string, password: string, reqCtx: RequestContext) {
    try {
      const client = await this.getClient();
      // Authenticate with Medusa
      const authResult = await client.auth.login('customer', 'emailpass', {
        email,
        password,
      });

      if (typeof authResult === 'string') {
        const token = authResult;
        if (token) {
          // await tokenStore.setToken(token);
          await client.client.setToken(token);
        }
      }

      // Get customer details
      const customerResponse = await client.store.customer.retrieve();

      if (customerResponse.customer) {
        const identity = {
          id: {
            userId: customerResponse.customer.id,
          },
          type: 'Registered',
        } satisfies RegisteredIdentity;
        return identity;
      }

      return {
        type: 'Anonymous',
      } satisfies AnonymousIdentity;
    } catch (error) {
      debug('Login failed:', error);
      throw new Error(
        `Login failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  public async listAuthProviders(): Promise<
    Array<{ id: string; displayName: string; flow: 'credentials' | 'redirect' }>
  > {
    const client = await this.getClient();
    try {
      const { providers } = await client.auth.listProviders('customer');
      return providers.map((provider) => ({
        id: provider.id,
        displayName: provider.display_name ?? provider.id,
        flow: provider.flow === 'redirect' ? 'redirect' : 'credentials',
      }));
    } catch (error) {
      // Backends older than Medusa 2.19 have no provider listing; they only do email and password.
      debug('Listing auth providers failed, assuming emailpass only:', error);
      return [{ id: 'emailpass', displayName: 'Email and password', flow: 'credentials' }];
    }
  }

  /**
   * Starts a redirect login. Returns the identity provider location and the state Medusa
   * generated, which the caller binds to the session.
   */
  public async startExternalLogin(providerKey: string, callbackUrl: string) {
    const client = await this.getClient();
    const result = await client.auth.login('customer', providerKey, {
      callback_url: callbackUrl,
    });
    if (typeof result === 'string' || !('location' in result)) {
      throw new Error(`Auth provider ${providerKey} does not use a redirect flow`);
    }
    const state = new URL(result.location).searchParams.get('state');
    if (!state) {
      throw new Error(`Auth provider ${providerKey} returned no state`);
    }
    return { location: result.location, state };
  }

  /**
   * Completes a redirect login. A first-time external identity has no Medusa customer yet,
   * so one is created from the identity provider claims in the token.
   * Returns a conflict when a customer with that email already has an account.
   */
  public async completeExternalLogin(
    providerKey: string,
    callbackParameters: Record<string, string>
  ): Promise<
    | { type: 'Registered'; identity: RegisteredIdentity }
    | { type: 'Conflict'; message: string }
  > {
    const client = await this.getClient();
    const callbackResult = await client.auth.callback('customer', providerKey, callbackParameters);
    if (typeof callbackResult !== 'string') {
      throw new Error('Multi-factor and verification steps are not supported for external login');
    }
    await client.client.setToken(callbackResult);

    const claims = decodeJwtPayload(callbackResult);
    if (!claims.actor_id) {
      const metadata = claims.user_metadata ?? {};
      const email = typeof metadata['email'] === 'string' ? metadata['email'] : undefined;
      if (!email) {
        throw new Error('The identity provider did not return an email address');
      }
      const [fallbackFirst, ...fallbackRest] = String(metadata['name'] ?? '').split(' ');
      try {
        await client.store.customer.create({
          email,
          first_name: String(metadata['given_name'] ?? fallbackFirst ?? ''),
          last_name: String(metadata['family_name'] ?? fallbackRest.join(' ')),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already has an account/i.test(message)) {
          await client.client.clearToken();
          return { type: 'Conflict', message };
        }
        throw error;
      }
      // The token was issued before the customer existed; refresh to pick up the actor.
      const refreshed = await client.auth.refresh();
      if (typeof refreshed === 'string' || !('token' in refreshed) || typeof refreshed.token !== 'string') {
        throw new Error('Could not refresh the token after creating the customer');
      }
      await client.client.setToken(refreshed.token);
    }

    const customerResponse = await client.store.customer.retrieve();
    return {
      type: 'Registered',
      identity: {
        id: { userId: customerResponse.customer.id },
        type: 'Registered',
      } satisfies RegisteredIdentity,
    };
  }

  public async logout(reqCtx: RequestContext) {
    const identity = {
      type: 'Anonymous',
    } satisfies AnonymousIdentity;

    const client = await this.getClient();
    try {
      // Clear the session on Medusa side
      await client.auth.logout();
      await client.client.clearToken();

      return identity;
    } catch (error) {
      debug('Logout failed:', error);
      await client.client.clearToken();

      return identity;
    }
  }

  protected async createAuthenticatedClient(
    reqCtx: RequestContext
  ): Promise<Medusa> {
    const tokenStore = new RequestContextTokenStore(reqCtx);

    // Create a client instance
    const authenticatedClient = new Medusa({
      baseUrl: this.config.apiUrl,
      publishableKey: this.config.publishable_key,
      debug: debug.enabled,
      globalHeaders: {
        'x-medusa-locale': this.context.languageContext.locale,
      },

      auth: {
        type: 'jwt',
        jwtTokenStorageMethod: 'custom',
        storage: tokenStore,
      },
    });

    // If we have a token, set it for authenticated requests
    /*
    if (initialToken) {
      // Set the authorization header for authenticated requests
      await authenticatedClient.client.setToken(initialToken);
      const token = await authenticatedClient.client.getToken()
      if (!token) {
        debug('Token validation failed, clearing token');
        await tokenStore.clearToken();
      }
    }*/

    return authenticatedClient;
  }
}


type MedusaTokenClaims = {
  actor_id?: string;
  user_metadata?: Record<string, unknown>;
};

/**
 * Reads the claims of a JWT without verifying it. Medusa has already verified the token,
 * and it was received directly from Medusa, so this is only used to read the claims.
 */
function decodeJwtPayload(token: string): MedusaTokenClaims {
  const segment = token.split('.')[1] ?? '';
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as MedusaTokenClaims;
}
