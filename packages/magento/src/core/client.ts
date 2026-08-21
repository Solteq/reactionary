import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { RequestContext } from '@reactionary/core';
import type {
  MagentoCheckoutAddress,
  MagentoCheckoutState,
  MagentoPaymentMethod,
  MagentoPlaceOrderPayload,
  MagentoProductLink,
  MagentoProductSearchResult,
  MagentoShippingInformationPayload,
  MagentoShippingInformationResult,
  MagentoShippingMethod,
} from '../schema/magento.types.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento');

export const SESSION_KEY = 'MAGENTO_PROVIDER';

/**
 * Magento enforces a password complexity policy (min. number of character
 * classes). Deterministically pad the password so it always satisfies the
 * policy; the same transform is applied on both register and login.
 */
export function ensureMagentoPasswordPolicy(password: string): string {
  let suffix = '';
  if (!/[A-Z]/.test(password)) suffix += 'A';
  if (!/[a-z]/.test(password)) suffix += 'a';
  if (!/[0-9]/.test(password)) suffix += '1';
  if (!/[^A-Za-z0-9]/.test(password)) suffix += '!';
  return `${password}${suffix}`;
}

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
  protected apiUrl: string;
  constructor(
    private baseUrl: string,
    private storeCode: string,
    private getAuthHeader: () => Promise<Record<string, string>>
  ) {
      this.apiUrl = `${this.baseUrl}/rest/${this.storeCode}`;
   }

  private normalizeUrl(path: string) {
    const base = this.apiUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: { allowNotFound?: boolean }
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

    if (res.status === 404 && options?.allowNotFound) {
      return undefined as T;
    }

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

export class Magento {
  private authRest: MagentoRest;
  private adminRest: MagentoRest;
  constructor(
    private rest: MagentoRest,
    private tokenStore: RequestContextTokenStore,
    authRest?: MagentoRest,
    adminRest?: MagentoRest
  ) {
    this.authRest = authRest ?? rest;
    this.adminRest = adminRest ?? rest;
  }

  public auth = {
    login: async (email: string, password: string) => {
      const token = await this.authRest.request<string>(
        'POST',
        '/V1/integration/customer/token',
        { username: email, password: ensureMagentoPasswordPolicy(password) }
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
    customer: {
      register: async (customer: any, password?: string) => {
        return this.authRest.request<any>('POST', '/V1/customers', {
          customer,
          password:
            password === undefined
              ? undefined
              : ensureMagentoPasswordPolicy(password),
        });
      },
      me: async () => {
        return this.authRest.request<any>('GET', '/V1/customers/me');
      },
      update: async (customer: any) => {
        return this.authRest.request<any>('PUT', '/V1/customers/me', { customer });
      },
    },
    product: {
      getBySKU: async (sku: string) => {
        return this.rest.request<any>(
          'GET',
          `/V1/products/${encodeURIComponent(sku)}`
        );
      },
      search: async (params: URLSearchParams) => {
        return this.rest.request<any>(
          'GET',
          `/V1/products?${params.toString()}`
        );
      },
      getLinks: async (sku: string, linkType: string) => {
        return this.rest.request<MagentoProductLink[]>(
          'GET',
          `/V1/products/${encodeURIComponent(sku)}/links/${encodeURIComponent(linkType)}`
        );
      },
    },
    category: {
      getById: async (categoryId: string) => {
        return this.rest.request<any>('GET', `/V1/categories/${encodeURIComponent(categoryId)}`);
      },
      getByExternalId: async (externalId: string) => {

        const params = new URLSearchParams();
        params.set('searchCriteria[filterGroups][0][filters][0][field]', 'external_id');
        params.set('searchCriteria[filterGroups][0][filters][0][value]', externalId);
        params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');
        params.set('searchCriteria[pageSize]', '1');
        const response = await this.rest.request<any>('GET', `/V1/categories/list?${params.toString()}`);
        return response.items?.[0] || null;
      },
      list: async (params: URLSearchParams) => {
        return this.rest.request<any>('GET', `/V1/categories/list?${params.toString()}`);
      },
    },
    inventory: {
      getStockStatus: async (sku: string) => {
        return this.rest.request<any>('GET', `/V1/stockStatuses/${encodeURIComponent(sku)}`);
      },
      getSourceItems: async (params: URLSearchParams) => {
        return this.rest.request<any>('GET', `/V1/inventory/source-items?${params.toString()}`);
      },
    },
    order: {
      list: async (params: URLSearchParams) => {
        return this.adminRest.request<any>('GET', `/V1/orders?${params.toString()}`);
      },
      get: async (id: string) => {
        return this.adminRest.request<any>(
          'GET',
          `/V1/orders/${encodeURIComponent(id)}`,
          undefined,
          { allowNotFound: true }
        );
      },
    },
    checkout: {
      estimateShippingMethods: async (
        cartId: string | null,
        address: MagentoCheckoutAddress,
        customerToken?: string | null,
      ) => {
        const body = { address };
        if (customerToken) {
          return this.rest.request<MagentoShippingMethod[]>('POST', '/V1/carts/mine/estimate-shipping-methods', body);
        }
        return this.rest.request<MagentoShippingMethod[]>('POST', `/V1/guest-carts/${cartId}/estimate-shipping-methods`, body);
      },
      getPaymentMethods: async (
        cartId: string | null,
        customerToken?: string | null,
      ) => {
        if (customerToken) {
          return this.rest.request<MagentoPaymentMethod[]>('GET', '/V1/carts/mine/payment-methods');
        }
        return this.rest.request<MagentoPaymentMethod[]>('GET', `/V1/guest-carts/${cartId}/payment-methods`);
      },
      setShippingInformation: async (
        cartId: string | null,
        payload: MagentoShippingInformationPayload,
        customerToken?: string | null,
      ) => {
        if (customerToken) {
          return this.rest.request<MagentoShippingInformationResult>('POST', '/V1/carts/mine/shipping-information', payload);
        }
        return this.rest.request<MagentoShippingInformationResult>('POST', `/V1/guest-carts/${cartId}/shipping-information`, payload);
      },
      setBillingAddress: async (
        cartId: string | null,
        address: MagentoCheckoutAddress,
        customerToken?: string | null,
      ) => {
        const body = { address };
        if (customerToken) {
          return this.rest.request<number>('POST', '/V1/carts/mine/billing-address', body);
        }
        return this.rest.request<number>('POST', `/V1/guest-carts/${cartId}/billing-address`, body);
      },
      placeOrder: async (
        cartId: string | null,
        payload: MagentoPlaceOrderPayload,
        customerToken?: string | null,
      ) => {
        if (customerToken) {
          return this.rest.request<number>('POST', '/V1/carts/mine/payment-information', payload);
        }
        return this.rest.request<number>('POST', `/V1/guest-carts/${cartId}/payment-information`, payload);
      },
    },
    cart: {
      create: async (customerToken?: string | null) => {
        if (customerToken) {
          const res = await this.rest.request<any>('POST', '/V1/carts/mine');
          return typeof res === 'string' ? res.replace(/^"|"$/g, '') : String(res);
        }
        const res = await this.rest.request<string>('POST', '/V1/guest-carts');
        return res.replace(/^"|"$/g, '');
      },
      get: async (cartId?: string | null, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<any>('GET', '/V1/carts/mine');
        }
        return this.rest.request<any>('GET', `/V1/guest-carts/${cartId}`);
      },
      getTotals: async (cartId?: string | null, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<any>('GET', '/V1/carts/mine/totals');
        }
        return this.rest.request<any>('GET', `/V1/guest-carts/${cartId}/totals`);
      },
      addItem: async (cartId: string | null, item: any, customerToken?: string | null) => {
        const id = (cartId && !isNaN(Number(cartId))) ? Number(cartId) : cartId;
        if (customerToken) {
          return this.rest.request<any>('POST', '/V1/carts/mine/items', {
            cartItem: { ...item, quote_id: id }
          });
        }
        return this.rest.request<any>('POST', `/V1/guest-carts/${cartId}/items`, {
          cartItem: { ...item, quote_id: id, quoteId: id }
        });
      },
      updateItem: async (cartId: string | null, itemId: number, item: any, customerToken?: string | null) => {
        const id = (cartId && !isNaN(Number(cartId))) ? Number(cartId) : cartId;
        if (customerToken) {
          return this.rest.request<any>('PUT', `/V1/carts/mine/items/${itemId}`, {
            cartItem: { ...item, item_id: itemId, quote_id: id }
          });
        }
        return this.rest.request<any>('PUT', `/V1/guest-carts/${cartId}/items/${itemId}`, {
          cartItem: { ...item, item_id: itemId, quote_id: id, quoteId: id }
        });
      },
      removeItem: async (cartId: string | null, itemId: number, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<any>('DELETE', `/V1/carts/mine/items/${itemId}`);
        }
        return this.rest.request<any>('DELETE', `/V1/guest-carts/${cartId}/items/${itemId}`);
      },
      applyCoupon: async (cartId: string | null, couponCode: string, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<any>('PUT', `/V1/carts/mine/coupons/${encodeURIComponent(couponCode)}`);
        }
        return this.rest.request<any>('PUT', `/V1/guest-carts/${cartId}/coupons/${encodeURIComponent(couponCode)}`);
      },
      removeCoupon: async (cartId: string | null, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<any>('DELETE', '/V1/carts/mine/coupons');
        }
        return this.rest.request<any>('DELETE', `/V1/guest-carts/${cartId}/coupons`);
      },
    },
  };
}

export class MagentoAdminClient {
  protected rest: MagentoRest;
  protected client: Magento;

  constructor(config: MagentoConfiguration, context: RequestContext) {
    const authHeader = async () => {
      const headers: Record<string, string> = {};
      const token = (config as any).adminApiKey ?? '';
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    };
    this.rest = new MagentoRest(config.baseUrl, config.storeCode, authHeader);
    const authRest = new MagentoRest(config.baseUrl, config.authStoreCode, authHeader);

    this.client = new Magento(this.rest, new RequestContextTokenStore(context), authRest);

    if (debug.enabled) debug('MagentoAdminClient created');
  }

  public async getClient(): Promise<Magento> {
    return this.client;
  }
}

export class MagentoClient {
  protected tokenStore: RequestContextTokenStore;
  protected rest: MagentoRest;
  protected authRest: MagentoRest;
  protected adminRest: MagentoRest;
  protected client: Promise<Magento> | undefined;

  constructor(
    protected config: MagentoConfiguration,
    context: RequestContext
  ) {
    this.tokenStore = new RequestContextTokenStore(context);
    this.client = undefined;

    const authHeader = async () => {
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
    };

    this.rest = new MagentoRest(this.config.baseUrl, this.config.storeCode, authHeader);
    this.authRest = new MagentoRest(this.config.baseUrl, this.config.authStoreCode, authHeader);
    this.adminRest = new MagentoRest(this.config.baseUrl, this.config.storeCode, async () => {
      const headers: Record<string, string> = {};
      if (this.config.adminApiKey) {
        headers['Authorization'] = `Bearer ${this.config.adminApiKey}`;
      }
      return headers;
    });

    if (debug.enabled) debug('MagentoClient created');
  }

  public async getClient(): Promise<Magento> {
    if (!this.client) {
      this.client = Promise.resolve(
        new Magento(this.rest, this.tokenStore, this.authRest, this.adminRest)
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
    return client.store.customer.me();
  }

  async getCustomerToken(): Promise<string | null> {
    return this.tokenStore.getItem('customerToken');
  }

  async getActiveCartId(): Promise<string | null> {
    return this.tokenStore.getItem('activeCartId');
  }

  async setActiveCartId(cartId: string): Promise<void> {
    return this.tokenStore.setItem('activeCartId', cartId);
  }

  async clearActiveCartId(): Promise<void> {
    return this.tokenStore.removeItem('activeCartId');
  }

  async register(customer: any, password?: string) {
    const client = await this.getClient();
    return client.store.customer.register(customer, password);
  }

  async updateMe(customer: any) {
    const client = await this.getClient();
    return client.store.customer.update(customer);
  }

  async searchOrders(params: URLSearchParams) {
    const client = await this.getClient();
    return client.store.order.list(params);
  }

  /** Returns undefined (not a thrown error) when Magento returns a 404 — no order with this entity_id. */
  async getOrderById(id: string): Promise<any> {
    const client = await this.getClient();
    return client.store.order.get(id);
  }

  async getProductBySKU(sku: string) {
    const client = await this.getClient();
    return client.store.product.getBySKU(sku);
  }

  async resolveProductForSKU(sku: string) {
    return this.getProductBySKU(sku);
  }

  async searchProducts(params: URLSearchParams): Promise<MagentoProductSearchResult> {
    const client = await this.getClient();
    return client.store.product.search(params);
  }

  async getProductLinks(
    sku: string,
    linkType: string,
  ): Promise<MagentoProductLink[]> {
    const client = await this.getClient();
    return client.store.product.getLinks(sku, linkType);
  }

  async createCart() {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.create(customerToken);
  }

  async getCart(cartId?: string | null) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.get(cartId, customerToken);
  }

  async getCartTotals(cartId?: string | null) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.getTotals(cartId, customerToken);
  }

  async addItemToCart(cartId: string | null, item: any) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.addItem(cartId, item, customerToken);
  }

  async updateCartItem(cartId: string | null, itemId: number, item: any) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.updateItem(cartId, itemId, item, customerToken);
  }

  async removeCartItem(cartId: string | null, itemId: number) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.removeItem(cartId, itemId, customerToken);
  }

  async applyCoupon(cartId: string | null, couponCode: string) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.applyCoupon(cartId, couponCode, customerToken);
  }

  async removeCoupon(cartId: string | null) {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.removeCoupon(cartId, customerToken);
  }

  async estimateShippingMethods(
    cartId: string | null,
    address: MagentoCheckoutAddress,
  ): Promise<MagentoShippingMethod[]> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.checkout.estimateShippingMethods(cartId, address, customerToken);
  }

  async getPaymentMethods(cartId: string | null): Promise<MagentoPaymentMethod[]> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.checkout.getPaymentMethods(cartId, customerToken);
  }

  async setShippingInformation(
    cartId: string | null,
    payload: MagentoShippingInformationPayload,
  ): Promise<MagentoShippingInformationResult> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.checkout.setShippingInformation(cartId, payload, customerToken);
  }

  async setCheckoutBillingAddress(
    cartId: string | null,
    address: MagentoCheckoutAddress,
  ): Promise<number> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.checkout.setBillingAddress(cartId, address, customerToken);
  }

  async placeOrder(
    cartId: string | null,
    payload: MagentoPlaceOrderPayload,
  ): Promise<number> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.checkout.placeOrder(cartId, payload, customerToken);
  }

  async getCheckoutState(cartKey: string): Promise<MagentoCheckoutState> {
    const raw = await this.tokenStore.getItem(`checkoutState:${cartKey}`);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as MagentoCheckoutState;
  }

  async setCheckoutState(cartKey: string, state: MagentoCheckoutState): Promise<void> {
    await this.tokenStore.setItem(`checkoutState:${cartKey}`, JSON.stringify(state));
  }
}
