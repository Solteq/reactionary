import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { RequestContext } from '@reactionary/core';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento');

export const SESSION_KEY = 'MAGENTO_PROVIDER';

type MagentoSession = {
  customerToken?: string | null;
};

export interface MagentoCustomStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class RequestContextTokenStore implements MagentoCustomStorage {
  constructor(
    protected context: RequestContext,
    public keyPrefix = '__x'
  ) { }

  private ensureNamespace() {
    if (this.context.session[SESSION_KEY] === undefined) {
      this.context.session[SESSION_KEY] = {} as MagentoSession;
    }
  }

  async getItem(key: string): Promise<string | null> {
    this.ensureNamespace();
    const session = this.context.session[SESSION_KEY] as MagentoSession;
    return (session as any)[`${this.keyPrefix}_${key}`] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.ensureNamespace();
    const session = this.context.session[SESSION_KEY] as MagentoSession;
    (session as any)[`${this.keyPrefix}_${key}`] = value;
  }

  async removeItem(key: string): Promise<void> {
    this.ensureNamespace();
    const session = this.context.session[SESSION_KEY] as MagentoSession;
    delete (session as any)[`${this.keyPrefix}_${key}`];
  }
}

class MagentoRest {
  constructor(
    private baseUrl: string,
    private getAuthHeader: () => Promise<Record<string, string>>
  ) { }

  private normalizeUrl(path: string) {
    const base = this.baseUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = this.normalizeUrl(path);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await this.getAuthHeader()),
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Magento request failed: ${method} ${path} → ${res.status}\n${text}`
      );
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }

    return (await res.text()) as unknown as T;
  }
}

class Magento {
  constructor(
    private rest: MagentoRest,
    private tokenStore: RequestContextTokenStore
  ) { }

  public auth = {
    login: async (email: string, password: string) => {
      const token = await this.rest.request<string>(
        'POST',
        '/V1/integration/customer/token',
        { username: email, password }
      );

      const normalized =
        typeof token === 'string' ? token.replace(/^"|"$/g, '') : String(token);

      await this.tokenStore.setItem('customerToken', normalized);
      return normalized;
    },

    logout: async () => {
      await this.tokenStore.removeItem('customerToken');
    },
  };

  public store = {
    me: async () => {
      return this.rest.request<any>('GET', '/V1/customers/me');
    },

    product: {
      getBySKU: async (sku: string) => {
        return this.rest.request<any>(
          'GET',
          `/V1/products/${encodeURIComponent(sku)}`
        );
      },
    },
  };
}

export class MagentoAdminClient {
  protected rest: MagentoRest;
  protected client: Magento;

  constructor(config: MagentoConfiguration, context: RequestContext) {
    this.rest = new MagentoRest(config.apiUrl, async () => {
      const headers: Record<string, string> = {};
      const token = (config as any).adminApiKey ?? '';
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    });

    this.client = new Magento(this.rest, new RequestContextTokenStore(context));

    if (debug.enabled) debug('MagentoAdminClient created');
  }

  public async getClient(): Promise<Magento> {
    return this.client;
  }
}

export class MagentoClient {
  protected tokenStore: RequestContextTokenStore;
  protected rest: MagentoRest;
  protected client: Promise<Magento> | undefined;

  constructor(
    protected config: MagentoConfiguration,
    context: RequestContext
  ) {
    this.tokenStore = new RequestContextTokenStore(context);
    this.client = undefined;

    this.rest = new MagentoRest(this.config.apiUrl, async () => {
      const headers: Record<string, string> = {};

      const customerToken = await this.tokenStore.getItem('customerToken');
      if (customerToken) {
        headers['Authorization'] = `Bearer ${customerToken}`;
        return headers;
      }

      const adminToken = this.config.adminApiKey;
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }

      return headers;
    });

    if (debug.enabled) debug('MagentoClient created');
  }

  public async getClient(): Promise<Magento> {
    if (!this.client) {
      this.client = Promise.resolve(
        new Magento(this.rest, this.tokenStore)
      );
    }
    return this.client;
  }

  async login(email: string, password: string) {
    const client = await this.getClient();
    return client.auth.login(email, password);
  }

  async logout() {
    const client = await this.getClient();
    return client.auth.logout();
  }

  async getMe() {
    const client = await this.getClient();
    return client.store.me();
  }

  async getProductBySKU(sku: string) {
    const client = await this.getClient();
    return client.store.product.getBySKU(sku);
  }

  async resolveProductForSKU(sku: string) {
    return this.getProductBySKU(sku);
  }
}
