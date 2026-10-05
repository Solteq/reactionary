import type {
  Cart,
  Category,
  FacetValueIdentifier,
  Identity,
  Product,
  ProductSearchResult,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  ProductVariant,
} from '@reactionary/core';
import * as z from 'zod';
import type { components } from './ucp-shopping.openapi.js';
import type { ReactionaryUCPClient, UCPPaymentHandlers } from './reactionary-ucp-common.js';
import { jsonResponse } from './reactionary-ucp-http.js';
import { getOrder, UCPOrderUpdateSchema, updateOrder } from './reactionary-ucp-order.js';
import type { ReactionaryUCPSessionStore } from './reactionary-ucp-session-store.js';
import {
  cancelCheckoutSession,
  completeCheckoutSession,
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutSession,
  type UCPCheckoutRequest,
  type UCPCheckoutSessionContext,
  type UCPInventoryOptions,
  type UCPPaymentAuthorizationWait,
  type UCPTestPaymentHandler,
} from './reactionary-ucp-checkout-session.js';
import {
  createUCPError,
  createUcpSuccessMetadata,
  createUcpWarning,
  getMoneyCurrency,
  toUcpCartLineItem,
  toUcpCostTotals,
  type UCPLineItem,
  type UCPMessage,
} from './reactionary-ucp-mapping.js';

type UCPErrorResponse = components['schemas']['error_response'];
type UCPCart = Omit<components['schemas']['cart'], 'currency' | 'id' | 'line_items' | 'totals' | 'ucp' | '$defs'> & {
  id: string;
  line_items: UCPLineItem[];
  currency: string;
  totals: components['schemas']['totals'];
  ucp: components['schemas']['response_cart_schema'];
};
type UCPCartResponse = UCPCart | UCPErrorResponse;
type UCPCatalogSearchRequest = components['schemas']['catalog_search_request'];
type UCPCatalogSearchResponse = components['schemas']['catalog_search_response'];
type UCPCatalogLookupRequest = components['schemas']['catalog_lookup_request'];
type UCPCatalogLookupResponse = components['schemas']['catalog_lookup_response'];
type UCPCatalogGetProductRequest = components['schemas']['catalog_get_product_request'];
type UCPCatalogGetProductResponse = components['schemas']['catalog_get_product_response'];
type UCPProduct = components['schemas']['product'];
type UCPVariant = components['schemas']['variant'];

export async function handleRestRequest(
  request: Request,
  client: ReactionaryUCPClient,
  path: string,
  sessionId: string,
  sessionStore: ReactionaryUCPSessionStore,
  options: UCPRestOptions,
): Promise<Response | undefined> {
  const checkoutContext = createCheckoutSessionContext(client, sessionId, sessionStore, options);

  if (request.method === 'POST' && path === '/catalog/search') {
    return jsonResponse(await handleCatalogSearch(client, await parseJsonBody<UCPCatalogSearchRequest>(request)));
  }

  if (request.method === 'POST' && path === '/catalog/lookup') {
    return jsonResponse(await handleCatalogLookup(client, await parseJsonBody<UCPCatalogLookupRequest>(request)));
  }

  if (request.method === 'POST' && path === '/catalog/product') {
    return jsonResponse(await handleCatalogProduct(client, await parseJsonBody<UCPCatalogGetProductRequest>(request)));
  }

  if (request.method === 'POST' && path === '/carts') {
    const body = await parseJsonBody<UCPCart>(request);
    return withRestIdempotency(
      request,
      sessionId,
      'REST POST /carts',
      body,
      sessionStore,
      async () => {
        const cart = await handleCreateCart(client, body);

        if (isUcpCart(cart)) {
          await sessionStore.bindResource(cart.id, sessionId);
        }

        return createdResponse(cart);
      },
    );
  }

  const cartMatch = /^\/carts\/([^/]+)$/.exec(path);
  if (cartMatch && request.method === 'GET') {
    return jsonResponse(await handleGetCart(client, decodeURIComponent(cartMatch[1])));
  }
  if (cartMatch && request.method === 'PUT') {
    const body = await parseJsonBody<UCPCart>(request);
    return withRestIdempotency(
      request,
      sessionId,
      `REST PUT /carts/${decodeURIComponent(cartMatch[1])}`,
      body,
      sessionStore,
      async () => jsonResponse(await handleUpdateCart(client, decodeURIComponent(cartMatch[1]), body)),
    );
  }

  const cartCancelMatch = /^\/carts\/([^/]+)\/cancel$/.exec(path);
  if (cartCancelMatch && request.method === 'POST') {
    return withRestIdempotency(
      request,
      sessionId,
      `REST POST /carts/${decodeURIComponent(cartCancelMatch[1])}/cancel`,
      {},
      sessionStore,
      async () => jsonResponse(await handleCancelCart(client, decodeURIComponent(cartCancelMatch[1]))),
    );
  }

  if (request.method === 'POST' && path === '/checkout-sessions') {
    const body = await parseJsonBody<UCPCheckoutRequest>(request);
    return withRestIdempotency(
      request,
      sessionId,
      'REST POST /checkout-sessions',
      body,
      sessionStore,
      async () => createdResponse(await createCheckoutSession(checkoutContext, body)),
    );
  }

  const checkoutMatch = /^\/checkout-sessions\/([^/]+)$/.exec(path);
  if (checkoutMatch && request.method === 'GET') {
    return checkoutResponse(await getCheckoutSession(checkoutContext, decodeURIComponent(checkoutMatch[1])));
  }
  if (checkoutMatch && request.method === 'PUT') {
    const body = await parseJsonBody<UCPCheckoutRequest>(request);
    return withRestIdempotency(
      request,
      sessionId,
      `REST PUT /checkout-sessions/${decodeURIComponent(checkoutMatch[1])}`,
      body,
      sessionStore,
      async () => checkoutResponse(await updateCheckoutSession(checkoutContext, decodeURIComponent(checkoutMatch[1]), body)),
    );
  }

  const checkoutCompleteMatch = /^\/checkout-sessions\/([^/]+)\/complete$/.exec(path);
  if (checkoutCompleteMatch && request.method === 'POST') {
    const body = await parseJsonBody<UCPCheckoutRequest>(request);
    return withRestIdempotency(
      request,
      sessionId,
      `REST POST /checkout-sessions/${decodeURIComponent(checkoutCompleteMatch[1])}/complete`,
      body,
      sessionStore,
      async () => checkoutResponse(await completeCheckoutSession(checkoutContext, decodeURIComponent(checkoutCompleteMatch[1]), body)),
    );
  }

  const checkoutCancelMatch = /^\/checkout-sessions\/([^/]+)\/cancel$/.exec(path);
  if (checkoutCancelMatch && request.method === 'POST') {
    return withRestIdempotency(
      request,
      sessionId,
      `REST POST /checkout-sessions/${decodeURIComponent(checkoutCancelMatch[1])}/cancel`,
      {},
      sessionStore,
      async () => checkoutResponse(await cancelCheckoutSession(checkoutContext, decodeURIComponent(checkoutCancelMatch[1]))),
    );
  }

  const orderMatch = /^\/orders\/([^/]+)$/.exec(path);
  const orderContext = { client, store: sessionStore, merchantUrl: options.merchantUrl };
  if (orderMatch && request.method === 'GET') {
    return jsonResponse(await getOrder(orderContext, decodeURIComponent(orderMatch[1])));
  }

  if (orderMatch && request.method === 'PUT' && options.testOrderUpdates) {
    const update = UCPOrderUpdateSchema.safeParse(await parseJsonBody<unknown>(request));

    if (!update.success) {
      throw new UCPHttpError(422, createUCPError('invalid_request', `Invalid order update: ${z.prettifyError(update.error)}`));
    }

    return jsonResponse(await updateOrder(orderContext, decodeURIComponent(orderMatch[1]), update.data));
  }

  return undefined;
}

export interface UCPRestOptions {
  paymentHandlers: UCPPaymentHandlers;
  placeholderEmail: string;
  paymentAuthorizationWait: UCPPaymentAuthorizationWait;
  identity: Identity;
  /** The merchant's site URL, used to build order permalinks. */
  merchantUrl?: string;
  /** See ReactionaryUCPServerOptions.anonymousOrderEmail. */
  anonymousOrderEmail?: string;
  /** See ReactionaryUCPServerOptions.testPaymentHandlers. */
  testPaymentHandlers?: UCPTestPaymentHandler[];
  /** See ReactionaryUCPServerOptions.inventory. */
  inventory?: UCPInventoryOptions;
  /** See ReactionaryUCPServerOptions.testOrderUpdates. */
  testOrderUpdates?: boolean;
  /** The requesting platform's UCP-Agent profile URL. */
  agentProfile?: string;
}

function createCheckoutSessionContext(
  client: ReactionaryUCPClient,
  sessionId: string,
  sessionStore: ReactionaryUCPSessionStore,
  options: UCPRestOptions,
): UCPCheckoutSessionContext {
  let identityEmail: Promise<string | undefined> | undefined;

  return {
    client,
    store: sessionStore,
    sessionId,
    paymentHandlers: options.paymentHandlers,
    placeholderEmail: options.placeholderEmail,
    paymentAuthorizationWait: options.paymentAuthorizationWait,
    merchantUrl: options.merchantUrl,
    anonymousOrderEmail: options.anonymousOrderEmail,
    testPaymentHandlers: options.testPaymentHandlers,
    inventory: options.inventory,
    agentProfile: options.agentProfile,
    getIdentityEmail() {
      identityEmail ??= getRegisteredIdentityEmail(client, options.identity);
      return identityEmail;
    },
    async createCart(lineItems: UCPLineItem[]) {
      const created = await handleCreateCart(client, {
        id: '',
        line_items: lineItems,
        currency: '',
        totals: [],
        ucp: createUcpSuccessMetadata(),
      });

      if (!isUcpCart(created)) {
        return created;
      }

      return (await getReactionaryCart(client, created.id))
        ?? createUCPError('not_found', `Cart was not found: ${created.id}`);
    },
    async reconcileCart(cartId: string, lineItems: UCPLineItem[]) {
      const updated = await handleUpdateCart(client, cartId, {
        id: cartId,
        line_items: lineItems,
        currency: '',
        totals: [],
        ucp: createUcpSuccessMetadata(),
      });

      return isUcpCart(updated) ? undefined : updated;
    },
  };
}

async function getRegisteredIdentityEmail(
  client: ReactionaryUCPClient,
  identity: Identity,
): Promise<string | undefined> {
  if (identity.type !== 'Registered' || !client.profile) {
    return undefined;
  }

  const profile = await client.profile.getById({ identifier: identity.id });

  return profile.success && profile.value.email ? profile.value.email : undefined;
}

function getAgentProfile(request: Request): string | undefined {
  const agent = request.headers.get('UCP-Agent');
  const profile = agent ? /profile="([^"]*)"/.exec(agent)?.[1] : undefined;

  return profile ? `agent:${profile}` : undefined;
}

const CHECKOUT_ERROR_STATUSES: Record<string, number> = {
  not_found: 404,
  checkout_not_modifiable: 409,
};

/** Maps resourceless checkout errors to transport status; in-band messages on a resource stay 200. */
function checkoutResponse(body: { ucp: { status?: string }; messages?: Array<{ type: string; code?: string }> }): Response {
  const code = body.ucp.status === 'error' ? body.messages?.[0]?.code : undefined;

  return jsonResponse(body, { status: (code && CHECKOUT_ERROR_STATUSES[code]) || 200 });
}

function createdResponse(body: { ucp: { status?: string } }): Response {
  return jsonResponse(body, { status: body.ucp.status === 'error' ? 200 : 201 });
}

async function withRestIdempotency(
  request: Request,
  sessionId: string,
  action: string,
  payload: unknown,
  sessionStore: ReactionaryUCPSessionStore,
  createResponse: () => Promise<Response>,
): Promise<Response> {
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return createResponse();
  }

  // Agents identify themselves by their UCP-Agent profile and rarely echo our
  // session header, so their keys are scoped to the profile; anonymous
  // callers fall back to the UCP session.
  const scope = getAgentProfile(request) ?? sessionId;
  const fingerprint = JSON.stringify(payload);
  const cached = await sessionStore.getIdempotencyRecord(scope, idempotencyKey);
  if (cached) {
    if (cached.action !== action || cached.fingerprint !== fingerprint) {
      return jsonResponse(createUCPError('idempotency_key_conflict', 'The supplied Idempotency-Key was already used for a different UCP REST mutation.'), { status: 409 });
    }

    return jsonResponse(cached.response, { status: cached.status ?? 200 });
  }

  const response = await createResponse();
  const responseBody = await response.clone().json() as Record<string, unknown>;
  await sessionStore.putIdempotencyRecord(scope, idempotencyKey, {
    action,
    fingerprint,
    status: response.status,
    response: responseBody,
  });

  return response;
}

async function parseJsonBody<TBody>(
  request: Request,
): Promise<TBody> {
  if (!request.body) {
    return {} as TBody;
  }

  try {
    return await request.json() as TBody;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UCPHttpError(400, createUCPError('invalid_json', 'Request body must be valid JSON.'));
    }

    throw error;
  }
}

async function handleCatalogSearch(
  client: ReactionaryUCPClient,
  body: UCPCatalogSearchRequest,
): Promise<UCPCatalogSearchResponse> {
  if (!client.productSearch) {
    return createUCPError('not_available', 'Product search capability is not available.');
  }

  const pageSize = getLimit(body);
  const offset = getPaginationOffset(body);
  if (offset === undefined) {
    return createUCPError('invalid_request', 'Catalog search pagination cursor must be a non-negative integer offset.');
  }
  const filterMapping = await getSearchFilterMapping(client, body.filters);

  const result = await client.productSearch.queryByTerm({
    search: {
      term: body.query ?? '',
      facets: [],
      filters: filterMapping.filters,
      paginationOptions: {
        pageNumber: offsetToPageNumber(offset, pageSize),
        pageSize,
      },
      ...(filterMapping.categoryFilter ? { categoryFilter: filterMapping.categoryFilter } : {}),
    },
  });

  if (!result.success) {
    return createUCPError('search_failed', 'Catalog search failed.');
  }

  return {
    ucp: createUcpSuccessMetadata(),
    products: result.value.items.map((product) => toUcpProduct(product)),
    pagination: toUcpPagination(result.value),
    ...(filterMapping.messages.length > 0 ? { messages: filterMapping.messages } : {}),
  };
}

async function handleCatalogLookup(
  client: ReactionaryUCPClient,
  body: UCPCatalogLookupRequest,
): Promise<UCPCatalogLookupResponse> {
  const products = await Promise.all(
    body.ids.map((id) => getReactionaryProduct(client, id)),
  );

  return {
    ucp: createUcpSuccessMetadata(),
    products: products.filter((product): product is Product => product !== undefined).map((product) => toUcpProduct(product)),
  };
}

async function handleCatalogProduct(
  client: ReactionaryUCPClient,
  body: UCPCatalogGetProductRequest,
): Promise<UCPCatalogGetProductResponse> {
  const { id } = body;

  if (!id) {
    return createUCPError('invalid_request', 'A product id, variant id, or sku is required.');
  }

  const product = await getReactionaryProduct(client, id);
  if (!product) {
    return createUCPError('not_found', `Product was not found: ${id}`);
  }

  return {
    ucp: createUcpSuccessMetadata(),
    product: toUcpProduct(product),
  };
}

async function handleCreateCart(
  client: ReactionaryUCPClient,
  body: UCPCart,
): Promise<UCPCartResponse> {
  if (!client.cart) {
    return createUCPError('not_available', 'Cart capability is not available.');
  }

  const createResult = await client.cart.createCart({});

  if (!createResult.success) {
    return createUCPError('cart_create_failed', 'Cart creation failed.');
  }

  let cart = createResult.value;
  for (const lineItem of body['line_items']) {
    if (!lineItem.item.id) {
      return createUCPError('cart_add_failed', 'Unable to add cart line item without an item id.');
    }

    const addResult = await client.cart.add({
      cart: cart.identifier,
      variant: {
        sku: lineItem.item.id,
      },
      quantity: lineItem.quantity,
    });

    if (!addResult.success) {
      return createUCPError(
        'item_unavailable',
        `Item is not available for purchase: ${lineItem.item.id}`,
        `$.line_items[${body['line_items'].indexOf(lineItem)}]`,
      );
    }

    cart = addResult.value;
  }

  return toUcpCart(cart);
}

async function handleGetCart(
  client: ReactionaryUCPClient,
  cartId: string,
): Promise<UCPCartResponse> {
  if (!client.cart) {
    return createUCPError('not_available', 'Cart capability is not available.');
  }

  const result = await client.cart.getById({ cart: { key: cartId } });

  if (!result.success) {
    return createUCPError('not_found', `Cart was not found: ${cartId}`);
  }

  return toUcpCart(result.value);
}

async function handleUpdateCart(
  client: ReactionaryUCPClient,
  cartId: string,
  body: UCPCart,
): Promise<UCPCartResponse> {
  if (!client.cart) {
    return createUCPError('not_available', 'Cart capability is not available.');
  }

  const current = await client.cart.getById({ cart: { key: cartId } });

  if (!current.success) {
    return createUCPError('not_found', `Cart was not found: ${cartId}`);
  }

  const desiredItems = new Map<string, UCPLineItem>();
  for (const lineItem of body.line_items) {
    desiredItems.set(lineItem.item.id, lineItem);
  }

  let cart = current.value;
  for (const existingItem of current.value.items) {
    const sku = existingItem.variant.sku;
    const desiredItem = desiredItems.get(sku);

    if (!desiredItem) {
      const removeResult = await client.cart.remove({
        cart: current.value.identifier,
        item: existingItem.identifier,
      });

      if (!removeResult.success) {
        return createUCPError('cart_update_failed', `Unable to remove item from cart: ${sku}`);
      }

      cart = removeResult.value;
      continue;
    }

    if (existingItem.quantity !== desiredItem.quantity) {
      const quantityResult = await client.cart.changeQuantity({
        cart: current.value.identifier,
        item: existingItem.identifier,
        quantity: desiredItem.quantity,
      });

      if (!quantityResult.success) {
        return createUCPError('cart_update_failed', `Unable to change quantity for cart item: ${sku}`);
      }

      cart = quantityResult.value;
    }
  }

  const existingSkus = new Set(current.value.items.map((item) => item.variant.sku));
  for (const desiredItem of desiredItems.values()) {
    if (existingSkus.has(desiredItem.item.id)) {
      continue;
    }

    const addResult = await client.cart.add({
      cart: current.value.identifier,
      variant: {
        sku: desiredItem.item.id,
      },
      quantity: desiredItem.quantity,
    });

    if (!addResult.success) {
      return createUCPError('cart_update_failed', `Unable to add item to cart: ${desiredItem.item.id}`);
    }

    cart = addResult.value;
  }

  return toUcpCart(cart);
}

async function handleCancelCart(
  client: ReactionaryUCPClient,
  cartId: string,
): Promise<UCPCartResponse> {
  if (!client.cart) {
    return createUCPError('not_available', 'Cart capability is not available.');
  }

  // Pass the fetched identifier through: provider-specific identifiers can
  // carry more than the key (commercetools needs the cart version to delete).
  const current = await client.cart.getById({ cart: { key: cartId } });
  const deleted = await client.cart.deleteCart({
    cart: current.success ? current.value.identifier : { key: cartId },
  });

  if (!deleted.success) {
    return createUCPError('cart_cancel_failed', `Unable to cancel cart: ${cartId}`);
  }

  return current.success ? toUcpCart(current.value) : createEmptyUcpCart(cartId);
}

async function getReactionaryCart(
  client: ReactionaryUCPClient,
  cartId: string,
): Promise<Cart | undefined> {
  if (!client.cart) {
    return undefined;
  }

  const result = await client.cart.getById({ cart: { key: cartId } });

  return result.success ? result.value : undefined;
}

async function getReactionaryProduct(
  client: ReactionaryUCPClient,
  id: string,
): Promise<Product | undefined> {
  if (!client.product) {
    return undefined;
  }

  const byId = await client.product.getById({ identifier: { key: id } });
  if (byId.success) {
    return byId.value;
  }

  const bySku = await client.product.getBySKU({ variant: { sku: id } });

  return bySku.success ? bySku.value : undefined;
}

function toUcpProduct(
  product: ProductSearchResultItem | Product,
): UCPProduct {
  const ucpVariants = getUcpProductVariants(product);

  return {
    id: product.identifier.key,
    handle: product.slug,
    title: product.name,
    description: toUcpDescription(getProductDescription(product)),
    url: product.slug ? `/${product.slug}` : undefined,
    price_range: {
      min: ucpVariants[0]?.price ?? createUcpPrice(),
      max: ucpVariants[0]?.price ?? createUcpPrice(),
    },
    variants: ucpVariants,
    media: [],
  };
}

function getUcpProductVariants(
  product: ProductSearchResultItem | Product,
): UCPVariant[] {
  if (isProduct(product)) {
    return [
      product.mainVariant,
      ...product.variants,
    ].map((variant, index) => toUcpProductVariant(variant, product, index));
  }

  return product.variants.map((variant, index) => toUcpSearchVariant(variant, product, index));
}

function isProduct(
  product: ProductSearchResultItem | Product,
): product is Product {
  return 'mainVariant' in product;
}

function getProductDescription(
  product: ProductSearchResultItem | Product,
): string | undefined {
  return isProduct(product)
    ? product.description || product.longDescription
    : undefined;
}

function toUcpProductVariant(
  variant: ProductVariant,
  product: ProductSearchResultItem | Product,
  index: number,
): UCPVariant {
  const sku = variant.identifier.sku || `${product.identifier.key}-${index + 1}`;

  return {
    id: sku,
    sku,
    title: variant.name || product.name,
    description: toUcpDescription(undefined),
    price: createUcpPrice(),
    availability: {
      status: 'available',
    },
    media: [],
  };
}

function toUcpSearchVariant(
  variant: ProductSearchResultItemVariant,
  product: ProductSearchResultItem | Product,
  index: number,
): UCPVariant {
  const sku = variant.variant.sku || `${product.identifier.key}-${index + 1}`;

  return {
    id: sku,
    sku,
    title: product.name,
    description: toUcpDescription(undefined),
    price: createUcpPrice(),
    availability: {
      status: 'available',
    },
    media: variant.image.sourceUrl
      ? [{
        type: 'image',
        url: variant.image.sourceUrl,
        alt_text: variant.image.altText,
      }]
      : [],
  };
}

function toUcpCart(
  cart: Cart,
): UCPCart {
  return {
    id: cart.identifier.key,
    line_items: cart.items.map(toUcpCartLineItem),
    currency: getMoneyCurrency(cart.price?.grandTotal),
    totals: toUcpCostTotals(cart.price),
    ucp: createUcpSuccessMetadata(),
  };
}

function createEmptyUcpCart(
  cartId: string,
): UCPCart {
  return {
    id: cartId,
    line_items: [],
    currency: 'EUR',
    totals: [],
    ucp: createUcpSuccessMetadata(),
  };
}

function isUcpCart(
  response: UCPCartResponse,
): response is UCPCart {
  return 'id' in response && 'line_items' in response && 'currency' in response;
}


function toUcpDescription(
  text: string | undefined,
): components['schemas']['description'] {
  return text ? { plain: text } : { plain: '' };
}





function createUcpPrice(
  amount = 0,
  currency = 'EUR',
): components['schemas']['price'] {
  return {
    amount,
    currency,
  };
}







function getLimit(body: UCPCatalogSearchRequest): number {
  return body.pagination?.limit ?? 10;
}

async function getSearchFilterMapping(
  client: ReactionaryUCPClient,
  filters: UCPCatalogSearchRequest['filters'],
): Promise<{
  categoryFilter?: FacetValueIdentifier;
  filters: string[];
  messages: UCPMessage[];
}> {
  if (!filters) {
    return {
      filters: [],
      messages: [],
    };
  }

  const messages: UCPMessage[] = [];
  const categoryFilter = await getCategoryFilter(client, filters.categories, messages);

  if (filters.price) {
    messages.push(createUcpWarning(
      'price_filter_ignored',
      'Price filters are not supported by Reactionary product search yet and were ignored.',
      '$.filters.price',
    ));
  }

  return {
    ...(categoryFilter ? { categoryFilter } : {}),
    filters: getExtensionFilters(filters),
    messages,
  };
}

async function getCategoryFilter(
  client: ReactionaryUCPClient,
  categories: string[] | undefined,
  messages: UCPMessage[],
): Promise<FacetValueIdentifier | undefined> {
  const [category, ...additionalCategories] = categories ?? [];
  if (!category) {
    return undefined;
  }

  if (additionalCategories.length > 0) {
    messages.push(createUcpWarning(
      'additional_categories_ignored',
      'Reactionary product search currently supports one category filter; additional UCP category filters were ignored.',
      '$.filters.categories',
    ));
  }

  const productSearch = client.productSearch;
  if (!productSearch?.createCategoryNavigationFilter) {
    return {
      facet: { key: 'categories' },
      key: category,
    };
  }

  const result = await productSearch.createCategoryNavigationFilter({
    categoryPath: toReactionaryCategoryPath(category),
  });

  if (!result.success) {
    messages.push(createUcpWarning(
      'category_filter_ignored',
      `Category filter could not be resolved and was ignored: ${category}`,
      '$.filters.categories[0]',
    ));
    return undefined;
  }

  return result.value;
}

function toReactionaryCategoryPath(
  category: string,
): Category[] {
  return category
    .split('>')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => ({
      identifier: { key: part },
      name: part,
      slug: '',
      text: '',
      images: [],
    }));
}

function getExtensionFilters(
  filters: UCPCatalogSearchRequest['filters'],
): string[] {
  if (!filters) {
    return [];
  }

  return Object.entries(filters)
    .filter(([key]) => key !== 'categories' && key !== 'price')
    .flatMap(([key, value]) => toReactionaryFilterStrings(key, value));
}

function toReactionaryFilterStrings(
  key: string,
  value: unknown,
): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => toReactionaryFilterStrings(key, item));
  }

  return [`${key}:${formatFilterValue(value)}`];
}

function formatFilterValue(
  value: unknown,
): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function getPaginationOffset(
  body: UCPCatalogSearchRequest,
): number | undefined {
  const cursor = body.pagination?.cursor;
  if (cursor === undefined) {
    return 0;
  }

  if (!/^(0|[1-9]\d*)$/.test(cursor)) {
    return undefined;
  }

  return Number(cursor);
}

function offsetToPageNumber(
  offset: number,
  pageSize: number,
): number {
  return Math.floor(offset / pageSize) + 1;
}

function toUcpPagination(
  result: ProductSearchResult,
): components['schemas']['response'] {
  const nextOffset = result.pageNumber * result.pageSize;
  const hasNextPage = nextOffset < result.totalCount;

  return {
    ...(hasNextPage ? { cursor: String(nextOffset) } : {}),
    has_next_page: hasNextPage,
    total_count: result.totalCount,
  };
}

export class UCPHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super('UCP HTTP error');
  }
}
