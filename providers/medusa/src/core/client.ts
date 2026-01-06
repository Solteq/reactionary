import { Admin, Auth, Client, type Config, Store } from '@medusajs/js-sdk';

import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  AnonymousIdentitySchema,
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
const debug = createDebug('reactionary:medusa');

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
      ? this.context.session[SESSION_KEY][this.keyPrefix + '_' + key] || null
      : null;
    if (debug.enabled) {
      debug(
        `Getting token item for key: ${this.keyPrefix + '_' + key} - Found: ${
          retVal ? 'Yes' : 'No'
        }`
      );
    }
    return Promise.resolve(retVal);
  }

  setItem(key: string, value: string): Promise<void> {
    if (this.context.session[SESSION_KEY] === undefined) {
      this.context.session[SESSION_KEY] = {};
    }
    if (debug.enabled) {
      debug(
        `Setting token item for key: ${
          this.keyPrefix + '_' + key
        } - Value: ${value}`
      );
    }
    this.context.session[SESSION_KEY][this.keyPrefix + '_' + key] = value;
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    if (this.context.session[SESSION_KEY] === undefined) {
      this.context.session[SESSION_KEY] = {};
    }
    if (debug.enabled) {
      debug(`Removing token item for key: ${this.keyPrefix + '_' + key}`);
    }
    delete this.context.session[SESSION_KEY][this.keyPrefix + '_' + key];
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
    console.log(
      'MedusaAdminClient config:',
      this.config,
      'Debug enabled:',
      debug.enabled
    );
    this.client = new Medusa({
      baseUrl: this.config.apiUrl,
      apiKey: this.config.adminApiKey,
      debug: true,
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

    console.log(
      'MedusaClient config:',
      this.config,
      'Debug enabled:',
      debug.enabled
    );
    this.client = undefined;
  }

  public async getActiveRegion() {
    const session = this.getSessionData();
    if (session.selectedRegion) {
      return session.selectedRegion;
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

  public async resolveProductForSKU(sku: string): Promise<StoreProduct> {
    const adminClient = await new MedusaAdminAPI(
      this.config,
      this.context
    ).getClient();

    const productsResponse = await adminClient.admin.product.list({
      limit: 1,
      offset: 0,
      fields: '+metadata.*,+categories.metadata.*',
      variants: {
        $or: [{ ean: sku }, { upc: sku }, { barcode: sku }],
      },
    });

    const product = productsResponse.products[0];
    if (!product) {
      throw new Error(`Product with SKU ${sku} not found`);
    }
    return product;
  }

  /**
   * This function should not need to exist.
   * It returns a product-id, given a SKU.
   * @param sku
   * @returns
   */
  public async resolveVariantId(sku: string): Promise<string> {
    // FIXME: Medusa does not support searching by SKU directly, so we have to use the admin client to search for products with variants matching the SKU
    const product = await this.resolveProductForSKU(sku);

    const variant = product.variants?.find((v) => v.sku === sku);
    if (!variant) {
      throw new Error(`Variant with SKU ${sku} not found`);
    }

    return variant.id;
  }

  public async getClient(): Promise<Medusa> {
    if (!this.client) {
      this.client = this.createAuthenticatedClient(this.context);
    }
    return await this.client;
  }

  public getSessionData(): MedusaSession {
    return this.context.session[SESSION_KEY]
      ? this.context.session[SESSION_KEY]
      : MedusaSessionSchema.parse({});
  }

  public setSessionData(sessionData: Partial<MedusaSession>): void {
    const existingData = this.context.session[SESSION_KEY];

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
      debug: true,

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
