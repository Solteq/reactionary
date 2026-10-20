import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { RequestContext } from '@reactionary/core';
import type {
  MagentoCart,
  MagentoCartItem,
  MagentoCartItemInput,
  MagentoCartItemUpdateInput,
  MagentoCartTotals,
  MagentoCategory,
  MagentoCategorySearchResult,
  MagentoCheckoutAddress,
  MagentoCheckoutState,
  MagentoConfigurableProductOption,
  MagentoCreateProductReviewInput,
  MagentoCreateProductReviewResult,
  MagentoCustomerCreateInput,
  MagentoCustomerData,
  MagentoCustomerUpdateInput,
  MagentoGraphQLError,
  MagentoGraphQLResponse,
  MagentoPaymentMethod,
  MagentoPlaceOrderPayload,
  MagentoProduct,
  MagentoProductLink,
  MagentoProductReview,
  MagentoProductReviewRatingMetadata,
  MagentoProductReviewRatingsMetadataQueryResult,
  MagentoProductReviewsQueryResult,
  MagentoProductSearchResult,
  MagentoReviewableProduct,
  MagentoSalesOrder,
  MagentoSalesOrderSearchResult,
  MagentoShippingInformationPayload,
  MagentoShippingInformationResult,
  MagentoShippingMethod,
  MagentoSourceItemSearchResult,
  MagentoStockStatus,
} from '../schema/magento.types.js';
import {
  CREATE_PRODUCT_REVIEW_MUTATION,
  PRODUCT_RATING_SUMMARY_QUERY,
  PRODUCT_REVIEWS_QUERY,
  PRODUCT_REVIEW_RATINGS_METADATA_QUERY,
} from './product-reviews.graphql.js';
import {
  MagentoApiError,
  isMagentoApiError,
  parseMagentoRestErrorBody,
  type MagentoHttpMethod,
} from './errors.js';
import {
  resolveMagentoStoreViewCodeForContext,
} from '../utils/magento-store-view.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento');

export const SESSION_KEY = 'MAGENTO_PROVIDER';

/**
 * Prefix for the session items feature modules store through
 * `MagentoClient.setSessionItem`, keeping them clear of the client's own
 * entries (customer token, active cart, checkout state).
 */
const FEATURE_SESSION_PREFIX = 'feature:';

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

/** The provider's namespace in the request session: flat string entries. */
type MagentoSession = Record<string, string | undefined>;

function isMagentoSession(value: unknown): value is MagentoSession {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

  private namespace(): MagentoSession {
    const existing = this.context.session[SESSION_KEY];
    if (isMagentoSession(existing)) {
      return existing;
    }
    const created: MagentoSession = {};
    this.context.session[SESSION_KEY] = created;
    return created;
  }

  async getItem(key: string): Promise<string | null> {
    const value = this.namespace()[`${this.keyPrefix}_${key}`];
    return typeof value === 'string' ? value : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.namespace()[`${this.keyPrefix}_${key}`] = value;
  }

  async removeItem(key: string): Promise<void> {
    delete this.namespace()[`${this.keyPrefix}_${key}`];
  }
}

/**
 * The store scope a transport addresses. A resolver is passed wherever the
 * scope depends on the request locale, so the store view is computed at call
 * time rather than frozen when the client is built.
 */
export type MagentoStoreCode = string | (() => string);

function toStoreCodeResolver(storeCode: MagentoStoreCode): () => string {
  if (typeof storeCode === 'function') {
    return () => {
      const resolved = storeCode();
      return typeof resolved === 'string' ? resolved : '';
    };
  }
  return () => storeCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGraphQLError(value: unknown): value is MagentoGraphQLError {
  return isRecord(value) && typeof value['message'] === 'string';
}

/** Reads the `errors` array out of a (possibly non-2xx) GraphQL body. */
function readGraphQLErrors(body: string): MagentoGraphQLError[] | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed) && Array.isArray(parsed['errors'])) {
      return parsed['errors'].filter(isGraphQLError);
    }
  } catch {
    // not JSON: the raw body is kept on the error instead
  }
  return undefined;
}

class MagentoRest {
  private resolveStoreCode: () => string;
  constructor(
    private baseUrl: string,
    storeCode: MagentoStoreCode,
    private getAuthHeader: () => Promise<Record<string, string>>
  ) {
    this.resolveStoreCode = toStoreCodeResolver(storeCode);
  }

  protected get apiUrl(): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const storeCode = this.resolveStoreCode();
    return storeCode ? `${base}/rest/${encodeURIComponent(storeCode)}` : `${base}/rest`;
  }

  private normalizeUrl(path: string) {
    const base = this.apiUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
  }

  /**
   * Performs the call and decodes the JSON body. Non-2xx responses are thrown
   * as `MagentoApiError`.
   */
  async request<T>(
    method: MagentoHttpMethod,
    path: string,
    body?: unknown,
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

    const text = await res.text().catch(() => '');

    if (!res.ok) {
      throw new MagentoApiError({
        transport: 'rest',
        status: res.status,
        method,
        url,
        body: text,
        ...parseMagentoRestErrorBody(text),
      });
    }

    // Magento answers every REST call with JSON, scalars included (a cart id
    // or a token is a JSON string, a DELETE is `true`).
    try {
      const decoded: T = JSON.parse(text === '' ? 'null' : text);
      return decoded;
    } catch {
      throw new MagentoApiError(
        { transport: 'rest', status: res.status, method, url, body: text },
        `Magento returned a non-JSON response: ${method} ${url} → ${res.status}`,
      );
    }
  }

  /** As `request`, but resolves `undefined` when Magento answers 404. */
  async requestOrUndefined<T>(
    method: MagentoHttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T | undefined> {
    try {
      return await this.request<T>(method, path, body);
    } catch (err) {
      if (isMagentoApiError(err) && err.status === 404) {
        return undefined;
      }
      throw err;
    }
  }
}

/** Per-call options for a storefront GraphQL request. */
export interface MagentoGraphQLRequestOptions {
  /**
   * Extra request headers, such as `X-Adobe-Company` to pick the company
   * context of a B2B call. They are sent after the credential and `Store`
   * headers; `Authorization` and `Content-Type` cannot be set this way and are
   * ignored (in any letter case).
   */
  headers?: Record<string, string>;
}

/** Headers a caller can never set through {@link MagentoGraphQLRequestOptions}. */
const RESERVED_GRAPHQL_HEADERS = new Set(['authorization', 'content-type']);

/**
 * Reviews and ratings are absent from the Magento REST API, so they are read
 * and written over GraphQL. The store scope travels in the `Store` header
 * rather than in the path, which is the one structural difference from REST.
 */
export class MagentoGraphQL {
  private resolveStoreCode: () => string;
  constructor(
    private endpoint: string,
    storeCode: MagentoStoreCode,
    private getAuthHeader: () => Promise<Record<string, string>>
  ) {
    this.resolveStoreCode = toStoreCodeResolver(storeCode);
  }

  async request<T>(
    document: string,
    variables?: Record<string, unknown>,
    options?: MagentoGraphQLRequestOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await this.getAuthHeader()),
    };
    const storeCode = this.resolveStoreCode();
    if (storeCode) {
      headers['Store'] = storeCode;
    }
    // Caller headers (e.g. `X-Adobe-Company`) go last, but can never replace
    // the transport's credentials or content type.
    for (const [name, value] of Object.entries(options?.headers ?? {})) {
      const lower = name.toLowerCase();
      if (RESERVED_GRAPHQL_HEADERS.has(lower)) {
        continue;
      }
      // Header names are case-insensitive: replace, never duplicate.
      for (const existing of Object.keys(headers)) {
        if (existing.toLowerCase() === lower) {
          delete headers[existing];
        }
      }
      headers[name] = value;
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: document, variables }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new MagentoApiError({
        transport: 'graphql',
        status: res.status,
        method: 'POST',
        url: this.endpoint,
        body: text,
        graphqlErrors: readGraphQLErrors(text),
      });
    }

    // GraphQL reports failures with a 200 and a populated `errors` array.
    const payload: MagentoGraphQLResponse<T> = JSON.parse(await res.text());
    if (payload.errors && payload.errors.length > 0) {
      throw new MagentoApiError({
        transport: 'graphql',
        status: res.status,
        method: 'POST',
        url: this.endpoint,
        graphqlErrors: payload.errors,
      });
    }

    if (payload.data === undefined || payload.data === null) {
      throw new MagentoApiError(
        {
          transport: 'graphql',
          status: res.status,
          method: 'POST',
          url: this.endpoint,
        },
        'Magento GraphQL response contained no data.',
      );
    }

    return payload.data;
  }
}

function stripJsonQuotes(value: string | number): string {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : String(value);
}

/**
 * The typed Magento endpoints, grouped by domain. Each group is bound to the
 * transport whose credentials it needs:
 * - `rest` / `authRest` / `graphql`: storefront calls, sent with the customer
 *   token when one is held and anonymously otherwise;
 * - `catalogRest`: catalog reads (products, categories, stock), sent with the
 *   integration token because the REST catalog endpoints require it;
 * - `adminRest`: server-side admin operations (orders).
 */
export class Magento {
  private authRest: MagentoRest;
  private adminRest: MagentoRest;
  private catalogRest: MagentoRest;
  constructor(
    private rest: MagentoRest,
    private tokenStore: RequestContextTokenStore,
    authRest?: MagentoRest,
    adminRest?: MagentoRest,
    private graphql?: MagentoGraphQL,
    catalogRest?: MagentoRest,
  ) {
    this.authRest = authRest ?? rest;
    this.adminRest = adminRest ?? rest;
    this.catalogRest = catalogRest ?? rest;
  }

  private get gql(): MagentoGraphQL {
    if (!this.graphql) {
      throw new Error(
        'Magento GraphQL transport is not configured on this client.'
      );
    }
    return this.graphql;
  }

  public auth = {
    login: async (email: string, password: string) => {
      const token = await this.authRest.request<string>(
        'POST',
        '/V1/integration/customer/token',
        { username: email, password: ensureMagentoPasswordPolicy(password) }
      );

      const normalized = stripJsonQuotes(token);

      await this.tokenStore.setItem('customerToken', normalized);
      return normalized;
    },

    logout: async () => {
      await this.tokenStore.removeItem('customerToken');
    },
  };

  public store = {
    customer: {
      register: async (customer: MagentoCustomerCreateInput, password?: string) => {
        return this.authRest.request<MagentoCustomerData>('POST', '/V1/customers', {
          customer,
          password:
            password === undefined
              ? undefined
              : ensureMagentoPasswordPolicy(password),
        });
      },
      me: async () => {
        return this.authRest.request<MagentoCustomerData>('GET', '/V1/customers/me');
      },
      update: async (customer: MagentoCustomerUpdateInput) => {
        return this.authRest.request<MagentoCustomerData>('PUT', '/V1/customers/me', { customer });
      },
    },
    product: {
      getBySKU: async (sku: string) => {
        return this.catalogRest.request<MagentoProduct>(
          'GET',
          `/V1/products/${encodeURIComponent(sku)}`
        );
      },
      search: async (params: URLSearchParams) => {
        return this.catalogRest.request<MagentoProductSearchResult>(
          'GET',
          `/V1/products?${params.toString()}`
        );
      },
      getLinks: async (sku: string, linkType: string) => {
        return this.catalogRest.request<MagentoProductLink[]>(
          'GET',
          `/V1/products/${encodeURIComponent(sku)}/links/${encodeURIComponent(linkType)}`
        );
      },
      getConfigurableChildren: async (sku: string) => {
        return this.catalogRest.request<MagentoProduct[]>(
          'GET',
          `/V1/configurable-products/${encodeURIComponent(sku)}/children`
        );
      },
      getConfigurableOptions: async (sku: string) => {
        return this.catalogRest.request<MagentoConfigurableProductOption[]>(
          'GET',
          `/V1/configurable-products/${encodeURIComponent(sku)}/options/all`
        );
      },
    },
    productReviews: {
      getSummary: async (sku: string) => {
        return this.gql.request<MagentoProductReviewsQueryResult>(
          PRODUCT_RATING_SUMMARY_QUERY,
          { sku }
        );
      },
      list: async (sku: string, pageSize: number, currentPage: number) => {
        return this.gql.request<MagentoProductReviewsQueryResult>(
          PRODUCT_REVIEWS_QUERY,
          { sku, pageSize, currentPage }
        );
      },
      getRatingsMetadata: async () => {
        return this.gql.request<MagentoProductReviewRatingsMetadataQueryResult>(
          PRODUCT_REVIEW_RATINGS_METADATA_QUERY
        );
      },
      create: async (input: MagentoCreateProductReviewInput) => {
        return this.gql.request<MagentoCreateProductReviewResult>(
          CREATE_PRODUCT_REVIEW_MUTATION,
          { input }
        );
      },
    },
    category: {
      getById: async (categoryId: string) => {
        return this.catalogRest.request<MagentoCategory>('GET', `/V1/categories/${encodeURIComponent(categoryId)}`);
      },
      getByExternalId: async (externalId: string): Promise<MagentoCategory | null> => {

        const params = new URLSearchParams();
        params.set('searchCriteria[filterGroups][0][filters][0][field]', 'external_id');
        params.set('searchCriteria[filterGroups][0][filters][0][value]', externalId);
        params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');
        params.set('searchCriteria[pageSize]', '1');
        const response = await this.catalogRest.request<MagentoCategorySearchResult>('GET', `/V1/categories/list?${params.toString()}`);
        return response.items?.[0] || null;
      },
      list: async (params: URLSearchParams) => {
        return this.catalogRest.request<MagentoCategorySearchResult>('GET', `/V1/categories/list?${params.toString()}`);
      },
    },
    inventory: {
      getStockStatus: async (sku: string) => {
        return this.catalogRest.request<MagentoStockStatus>('GET', `/V1/stockStatuses/${encodeURIComponent(sku)}`);
      },
      getSourceItems: async (params: URLSearchParams) => {
        return this.catalogRest.request<MagentoSourceItemSearchResult>('GET', `/V1/inventory/source-items?${params.toString()}`);
      },
    },
    order: {
      list: async (params: URLSearchParams) => {
        return this.adminRest.request<MagentoSalesOrderSearchResult>('GET', `/V1/orders?${params.toString()}`);
      },
      /** Resolves `undefined` when Magento has no order with this entity_id. */
      get: async (id: string) => {
        return this.adminRest.requestOrUndefined<MagentoSalesOrder>(
          'GET',
          `/V1/orders/${encodeURIComponent(id)}`,
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
          // A customer quote id is numeric; a guest cart id is a masked string.
          const res = await this.rest.request<number | string>('POST', '/V1/carts/mine');
          return stripJsonQuotes(res);
        }
        const res = await this.rest.request<string>('POST', '/V1/guest-carts');
        return stripJsonQuotes(res);
      },
      get: async (cartId?: string | null, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<MagentoCart>('GET', '/V1/carts/mine');
        }
        return this.rest.request<MagentoCart>('GET', `/V1/guest-carts/${cartId}`);
      },
      getTotals: async (cartId?: string | null, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<MagentoCartTotals>('GET', '/V1/carts/mine/totals');
        }
        return this.rest.request<MagentoCartTotals>('GET', `/V1/guest-carts/${cartId}/totals`);
      },
      addItem: async (cartId: string | null, item: MagentoCartItemInput, customerToken?: string | null) => {
        const id = (cartId && !isNaN(Number(cartId))) ? Number(cartId) : cartId;
        if (customerToken) {
          return this.rest.request<MagentoCartItem>('POST', '/V1/carts/mine/items', {
            cartItem: { ...item, quote_id: id }
          });
        }
        return this.rest.request<MagentoCartItem>('POST', `/V1/guest-carts/${cartId}/items`, {
          cartItem: { ...item, quote_id: id, quoteId: id }
        });
      },
      updateItem: async (cartId: string | null, itemId: number, item: MagentoCartItemUpdateInput, customerToken?: string | null) => {
        const id = (cartId && !isNaN(Number(cartId))) ? Number(cartId) : cartId;
        if (customerToken) {
          return this.rest.request<MagentoCartItem>('PUT', `/V1/carts/mine/items/${itemId}`, {
            cartItem: { ...item, item_id: itemId, quote_id: id }
          });
        }
        return this.rest.request<MagentoCartItem>('PUT', `/V1/guest-carts/${cartId}/items/${itemId}`, {
          cartItem: { ...item, item_id: itemId, quote_id: id, quoteId: id }
        });
      },
      removeItem: async (cartId: string | null, itemId: number, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<boolean>('DELETE', `/V1/carts/mine/items/${itemId}`);
        }
        return this.rest.request<boolean>('DELETE', `/V1/guest-carts/${cartId}/items/${itemId}`);
      },
      applyCoupon: async (cartId: string | null, couponCode: string, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<boolean>('PUT', `/V1/carts/mine/coupons/${encodeURIComponent(couponCode)}`);
        }
        return this.rest.request<boolean>('PUT', `/V1/guest-carts/${cartId}/coupons/${encodeURIComponent(couponCode)}`);
      },
      removeCoupon: async (cartId: string | null, customerToken?: string | null) => {
        if (customerToken) {
          return this.rest.request<boolean>('DELETE', '/V1/carts/mine/coupons');
        }
        return this.rest.request<boolean>('DELETE', `/V1/guest-carts/${cartId}/coupons`);
      },
    },
  };
}

/**
 * Magento serves GraphQL from a fixed `/graphql` path next to the REST tree,
 * unless the installation was reverse-proxied elsewhere.
 */
export function resolveGraphQLEndpoint(config: MagentoConfiguration): string {
  if (config.graphqlUrl) {
    return config.graphqlUrl;
  }
  return `${config.baseUrl.replace(/\/+$/, '')}/graphql`;
}

function bearer(token: string | null | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * A client that runs every call with the integration (admin) token. Only for
 * trusted back-office tooling; storefront requests go through `MagentoClient`.
 */
export class MagentoAdminClient {
  protected rest: MagentoRest;
  protected client: Magento;

  constructor(config: MagentoConfiguration, context: RequestContext) {
    const authHeader = async () => bearer(config.adminApiKey);
    // Resolved per call rather than per client, so a context whose locale is
    // populated after construction still lands on the right store view.
    const storeViewCode = () =>
      resolveMagentoStoreViewCodeForContext(config.storeBaseCode, context);

    this.rest = new MagentoRest(config.baseUrl, storeViewCode, authHeader);
    // Customer auth lives on its own website scope and is never locale-suffixed.
    const authRest = new MagentoRest(config.baseUrl, config.authStoreCode, authHeader);
    const graphql = new MagentoGraphQL(
      resolveGraphQLEndpoint(config),
      storeViewCode,
      authHeader
    );

    this.client = new Magento(
      this.rest,
      new RequestContextTokenStore(context),
      authRest,
      undefined,
      graphql
    );

    if (debug.enabled) debug('MagentoAdminClient created');
  }

  public async getClient(): Promise<Magento> {
    return this.client;
  }
}

/**
 * The per-request Magento client.
 *
 * Credentials are scoped by transport. Storefront calls (cart, checkout,
 * customer account, GraphQL) carry the customer token when the shopper is
 * signed in and no `Authorization` header otherwise; they never fall back to
 * the integration token. The integration token (`adminApiKey`) is used only
 * for catalog reads (`catalogRequest`, `store.product|category|inventory`)
 * and for explicit server-side admin calls (`adminRequest`, orders).
 */
export class MagentoClient {
  protected tokenStore: RequestContextTokenStore;
  protected rest: MagentoRest;
  protected authRest: MagentoRest;
  protected adminRest: MagentoRest;
  protected catalogRest: MagentoRest;
  protected graphql: MagentoGraphQL;
  protected client: Promise<Magento> | undefined;
  private customerIdCache: { token: string; customerId: number | null } | undefined;

  constructor(
    protected config: MagentoConfiguration,
    context: RequestContext
  ) {
    this.tokenStore = new RequestContextTokenStore(context);
    this.client = undefined;

    const customerAuthHeader = async () =>
      bearer(await this.tokenStore.getItem('customerToken'));
    const adminAuthHeader = async () => bearer(this.config.adminApiKey);

    // Resolved per call rather than per client, so a context whose locale is
    // populated after construction still lands on the right store view.
    const storeViewCode = () =>
      resolveMagentoStoreViewCodeForContext(this.config.storeBaseCode, context);

    this.rest = new MagentoRest(this.config.baseUrl, storeViewCode, customerAuthHeader);
    // Customer auth lives on its own website scope and is never locale-suffixed.
    this.authRest = new MagentoRest(this.config.baseUrl, this.config.authStoreCode, customerAuthHeader);
    this.catalogRest = new MagentoRest(this.config.baseUrl, storeViewCode, adminAuthHeader);
    this.adminRest = new MagentoRest(this.config.baseUrl, storeViewCode, adminAuthHeader);
    this.graphql = new MagentoGraphQL(
      resolveGraphQLEndpoint(this.config),
      storeViewCode,
      customerAuthHeader
    );

    if (debug.enabled) debug('MagentoClient created');
  }

  public async getClient(): Promise<Magento> {
    if (!this.client) {
      this.client = Promise.resolve(
        new Magento(
          this.rest,
          this.tokenStore,
          this.authRest,
          this.adminRest,
          this.graphql,
          this.catalogRest
        )
      );
    }
    return this.client;
  }

  /**
   * A storefront GraphQL call in the request's store view. Sent with the
   * customer token when the shopper is signed in, anonymously otherwise.
   * `options.headers` adds request headers (e.g. `X-Adobe-Company`); they
   * cannot override `Authorization` or `Content-Type`.
   */
  async graphqlRequest<T>(
    document: string,
    variables?: Record<string, unknown>,
    options?: MagentoGraphQLRequestOptions,
  ): Promise<T> {
    return this.graphql.request<T>(document, variables, options);
  }

  /**
   * A storefront REST call in the request's store view (`/rest/{view}{path}`),
   * sent with the customer token when present and anonymously otherwise.
   */
  async storefrontRequest<T>(
    method: MagentoHttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.rest.request<T>(method, path, body);
  }

  /**
   * A customer-account REST call on the `authStoreCode` scope (never
   * locale-suffixed), with the customer token when present.
   */
  async accountRequest<T>(
    method: MagentoHttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.authRest.request<T>(method, path, body);
  }

  /**
   * A catalog read in the request's store view, authorised with the
   * integration token. Read-only by construction: only GET is issued.
   */
  async catalogRequest<T>(path: string): Promise<T> {
    return this.catalogRest.request<T>('GET', path);
  }

  /**
   * A server-side admin REST call with the integration token. Never pass a
   * caller-controlled path or act on a shopper's behalf without first
   * checking ownership (see `getCustomerId`).
   */
  async adminRequest<T>(
    method: MagentoHttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.adminRest.request<T>(method, path, body);
  }

  /**
   * Request-session storage for feature modules (e.g. a cart name). Keys live
   * in their own namespace and cannot clash with the client's entries.
   */
  async getSessionItem(key: string): Promise<string | null> {
    return this.tokenStore.getItem(`${FEATURE_SESSION_PREFIX}${key}`);
  }

  async setSessionItem(key: string, value: string): Promise<void> {
    return this.tokenStore.setItem(`${FEATURE_SESSION_PREFIX}${key}`, value);
  }

  async removeSessionItem(key: string): Promise<void> {
    return this.tokenStore.removeItem(`${FEATURE_SESSION_PREFIX}${key}`);
  }

  async login(email: string, password: string) {
    const client = await this.getClient();
    return client.auth.login(email, password);
  }

  async logout() {
    const client = await this.getClient();
    return client.auth.logout();
  }

  async getMe(): Promise<MagentoCustomerData> {
    const client = await this.getClient();
    return client.store.customer.me();
  }

  async getCustomerToken(): Promise<string | null> {
    return this.tokenStore.getItem('customerToken');
  }

  /**
   * The signed-in customer's Magento entity id, or null for guests and for a
   * token Magento no longer accepts. Looked up once per token per request,
   * so ownership checks can call it freely.
   */
  async getCustomerId(): Promise<number | null> {
    const token = await this.getCustomerToken();
    if (!token) {
      return null;
    }
    if (this.customerIdCache?.token === token) {
      return this.customerIdCache.customerId;
    }
    const customerId = await this.fetchCustomerId();
    this.customerIdCache = { token, customerId };
    return customerId;
  }

  private async fetchCustomerId(): Promise<number | null> {
    try {
      const me = await this.getMe();
      return typeof me.id === 'number' ? me.id : null;
    } catch (err) {
      if (isMagentoApiError(err) && (err.status === 401 || err.status === 403)) {
        return null;
      }
      throw err;
    }
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

  async register(customer: MagentoCustomerCreateInput, password?: string): Promise<MagentoCustomerData> {
    const client = await this.getClient();
    return client.store.customer.register(customer, password);
  }

  async updateMe(customer: MagentoCustomerUpdateInput): Promise<MagentoCustomerData> {
    const client = await this.getClient();
    return client.store.customer.update(customer);
  }

  /** Admin scope: callers must constrain `params` to the signed-in customer. */
  async searchOrders(params: URLSearchParams): Promise<MagentoSalesOrderSearchResult> {
    const client = await this.getClient();
    return client.store.order.list(params);
  }

  /**
   * Admin scope. Returns undefined (not a thrown error) when Magento returns a
   * 404 — no order with this entity_id. Callers must check ownership.
   */
  async getOrderById(id: string): Promise<MagentoSalesOrder | undefined> {
    const client = await this.getClient();
    return client.store.order.get(id);
  }

  async getProductBySKU(sku: string): Promise<MagentoProduct> {
    const client = await this.getClient();
    return client.store.product.getBySKU(sku);
  }

  async resolveProductForSKU(sku: string): Promise<MagentoProduct> {
    return this.getProductBySKU(sku);
  }

  async searchProducts(params: URLSearchParams): Promise<MagentoProductSearchResult> {
    const client = await this.getClient();
    return client.store.product.search(params);
  }

  /**
   * Searches the catalog on a single attribute, e.g. `external_id` or
   * `url_key`.
   */
  async searchProductsByAttribute(
    field: string,
    value: string | number,
    options: {
      conditionType?: 'eq' | 'like' | 'in';
      pageSize?: number;
      currentPage?: number;
    } = {},
  ): Promise<MagentoProductSearchResult> {
    const params = new URLSearchParams();
    params.set('searchCriteria[filterGroups][0][filters][0][field]', field);
    params.set('searchCriteria[filterGroups][0][filters][0][value]', String(value));
    params.set(
      'searchCriteria[filterGroups][0][filters][0][condition_type]',
      options.conditionType ?? 'eq',
    );
    params.set('searchCriteria[pageSize]', String(options.pageSize ?? 1));
    params.set('searchCriteria[currentPage]', String(options.currentPage ?? 1));
    return this.searchProducts(params);
  }

  async getConfigurableChildren(sku: string): Promise<MagentoProduct[]> {
    const client = await this.getClient();
    return client.store.product.getConfigurableChildren(sku);
  }

  async getConfigurableOptions(sku: string): Promise<MagentoConfigurableProductOption[]> {
    const client = await this.getClient();
    return client.store.product.getConfigurableOptions(sku);
  }

  async getProductLinks(
    sku: string,
    linkType: string,
  ): Promise<MagentoProductLink[]> {
    const client = await this.getClient();
    return client.store.product.getLinks(sku, linkType);
  }

  /** Returns null when no product matches the SKU in the current store scope. */
  async getProductReviewSummary(
    sku: string,
  ): Promise<MagentoReviewableProduct | null> {
    const client = await this.getClient();
    const result = await client.store.productReviews.getSummary(sku);
    return result.products?.items?.[0] ?? null;
  }

  /** Returns null when no product matches the SKU in the current store scope. */
  async getProductReviews(
    sku: string,
    pageSize: number,
    currentPage: number,
  ): Promise<MagentoReviewableProduct | null> {
    const client = await this.getClient();
    const result = await client.store.productReviews.list(
      sku,
      pageSize,
      currentPage,
    );
    return result.products?.items?.[0] ?? null;
  }

  async getProductReviewRatingsMetadata(): Promise<
    MagentoProductReviewRatingMetadata[]
  > {
    const client = await this.getClient();
    const result = await client.store.productReviews.getRatingsMetadata();
    return result.productReviewRatingsMetadata?.items ?? [];
  }

  async createProductReview(
    input: MagentoCreateProductReviewInput,
  ): Promise<MagentoProductReview | null> {
    const client = await this.getClient();
    const result = await client.store.productReviews.create(input);
    return result.createProductReview?.review ?? null;
  }

  async createCart(): Promise<string> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.create(customerToken);
  }

  async getCart(cartId?: string | null): Promise<MagentoCart> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.get(cartId, customerToken);
  }

  async getCartTotals(cartId?: string | null): Promise<MagentoCartTotals> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.getTotals(cartId, customerToken);
  }

  async addItemToCart(cartId: string | null, item: MagentoCartItemInput): Promise<MagentoCartItem> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.addItem(cartId, item, customerToken);
  }

  async updateCartItem(cartId: string | null, itemId: number, item: MagentoCartItemUpdateInput): Promise<MagentoCartItem> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.updateItem(cartId, itemId, item, customerToken);
  }

  async removeCartItem(cartId: string | null, itemId: number): Promise<boolean> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.removeItem(cartId, itemId, customerToken);
  }

  async applyCoupon(cartId: string | null, couponCode: string): Promise<boolean> {
    const client = await this.getClient();
    const customerToken = await this.tokenStore.getItem('customerToken');
    return client.store.cart.applyCoupon(cartId, couponCode, customerToken);
  }

  async removeCoupon(cartId: string | null): Promise<boolean> {
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
    const state: MagentoCheckoutState = JSON.parse(raw);
    return state;
  }

  async setCheckoutState(cartKey: string, state: MagentoCheckoutState): Promise<void> {
    await this.tokenStore.setItem(`checkoutState:${cartKey}`, JSON.stringify(state));
  }
}
