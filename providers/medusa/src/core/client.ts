
import  {  Admin,  Auth,  Client,  type Config,  Store }  from '@medusajs/js-sdk';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  AnonymousIdentitySchema,
  Reactionary,
  RegisteredIdentitySchema,
  type Currency,
  type RequestContext,
} from '@reactionary/core';
import createDebug from 'debug';
import { MedusaSessionSchema, type MedusaRegion, type MedusaSession } from '../index.js';
import type { StoreProduct } from '@medusajs/types';
const debug = createDebug('reactionary:medusa');

export const SESSION_KEY = 'MEDUSA_PROVIDER';

export interface MedusaAuthToken {
  token: string;
  expires_at?: Date;
}

export class RequestContextTokenStore {
  constructor(protected context: RequestContext) {}

  public async getToken(): Promise<string | undefined> {

    const session = this.context.session[SESSION_KEY] || {};
    return session.token;
  }

  public async setToken(token: string, expiresAt?: Date): Promise<void> {
    const session = this.context.session[SESSION_KEY] || {};
    session.token = token;
    if (expiresAt) {
      session.expiry = expiresAt;
    }
  }

  public async clearToken(): Promise<void> {
    this.context.session[SESSION_KEY].token = {};
    this.context.session[SESSION_KEY].expiry = new Date(0);
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
  protected context: RequestContext;

  constructor(config: MedusaConfiguration, context: RequestContext) {
    this.config = config;
    this.context = context;
    console.log('MedusaAdminClient config:', this.config, 'Debug enabled:', debug.enabled);
    this.client = new Medusa({
      baseUrl: this.config.apiUrl,
      apiKey: this.config.adminApiKey,
      debug: true
    });
  }

  public async getClient(): Promise<Medusa> {
    return this.client;
  }
}


export class MedusaClient {
  protected config: MedusaConfiguration;
  protected client: Promise<Medusa> | undefined;
  protected context: RequestContext;

  constructor(config: MedusaConfiguration, context: RequestContext) {
    this.config = config;
    this.context = context;

    console.log('MedusaClient config:', this.config, 'Debug enabled:', debug.enabled);
    this.client = undefined;
  }

  public async getActiveRegion() {
    const session = this.getSessionData();
    if(session.selectedRegion) {
      return session.selectedRegion;
    }

    const regions = await (await this.getClient()).store.region.list();
    const allRegions: MedusaRegion[] = [];
    for(const region of regions.regions) {
      allRegions.push({
        id: region.id,
        name: region.name,
        currency_code: region.currency_code,
      });
    }
    const selectedRegion = allRegions.find(r => r.currency_code === this.context.languageContext.currencyCode.toLowerCase()) || allRegions[0];
    this.context.languageContext.currencyCode = (selectedRegion || allRegions[0]).currency_code.toUpperCase() as Currency;

    this.setSessionData({
      allRegions,
      selectedRegion: selectedRegion,
    });
    return selectedRegion

  }


  public async resolveProductForSKU( sku: string): Promise<StoreProduct> {
      const adminClient = await new MedusaAdminClient(this.config, this.context).getClient();

      const productsResponse = await adminClient.admin.product.list({
        limit: 1,
        offset: 0,
        fields: "+categories.metadata.*",
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
  public async resolveVariantId( sku: string): Promise<string> {
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
    return this.context.session[SESSION_KEY] ? this.context.session[SESSION_KEY] : MedusaSessionSchema.parse({});
  }

  public setSessionData(sessionData: Partial<MedusaSession>): void {
    const existingData = this.context.session[SESSION_KEY];

    this.context.session[SESSION_KEY] = {
      ...existingData,
      ...sessionData
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
     await (await this.getClient()).auth.register(
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
      const authResult = await (await this.getClient()).auth.login("customer", "emailpass", {
        email,
        password,
      });

      const token = await (await this.getClient()).client.getToken();
      if (token) {
        await tokenStore.setToken(token);
      }

      // Get customer details
      const customerResponse = await (await this.getClient()).store.customer.retrieve();

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
        await (await this.getClient()).auth.logout();
        await (await this.getClient()).client.clearToken();
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
      debug: true,
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
