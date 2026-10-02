import type {
  Cart,
  Category,
  Checkout,
  CostBreakDown,
  FacetValueIdentifier,
  MonetaryAmount,
  Product,
  ProductSearchResult,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  ProductVariant,
} from '@reactionary/core';
import type { components } from './ucp-shopping.openapi.js';
import type { ReactionaryUCPClient, UCPPaymentHandlers } from './reactionary-ucp-common.js';
import { jsonResponse } from './reactionary-ucp-http.js';
import type { ReactionaryUCPSessionStore } from './reactionary-ucp-session-store.js';

type UCPErrorResponse = components['schemas']['error_response'];
type UCPCart = Omit<components['schemas']['cart'], 'currency' | 'id' | 'line_items' | 'totals' | 'ucp' | '$defs'> & {
  id: string;
  line_items: UCPLineItem[];
  currency: string;
  totals: components['schemas']['totals'];
  ucp: components['schemas']['response_cart_schema'];
};
type UCPCartResponse = UCPCart | UCPErrorResponse;
type UCPCheckout = components['schemas']['checkout'];
type UCPCheckoutRequest = UCPCheckout & {
  cart_id?: string;
};
type UCPCheckoutResponse = components['schemas']['checkout_response'];
type UCPCatalogSearchRequest = components['schemas']['catalog_search_request'];
type UCPCatalogSearchResponse = components['schemas']['catalog_search_response'];
type UCPCatalogLookupRequest = components['schemas']['catalog_lookup_request'];
type UCPCatalogLookupResponse = components['schemas']['catalog_lookup_response'];
type UCPCatalogGetProductRequest = components['schemas']['catalog_get_product_request'];
type UCPCatalogGetProductResponse = components['schemas']['catalog_get_product_response'];
type UCPOrder = Omit<components['schemas']['order'], '$defs'>;
type UCPOrderResponse = UCPOrder | UCPErrorResponse;
type UCPProduct = components['schemas']['product'];
type UCPVariant = components['schemas']['variant'];
type UCPLineItem = components['schemas']['line_item'];
type UCPMessage = components['schemas']['message'];

export async function handleRestRequest(
  request: Request,
  client: ReactionaryUCPClient,
  path: string,
  sessionId: string,
  sessionStore: ReactionaryUCPSessionStore,
  paymentHandlers: UCPPaymentHandlers = {},
): Promise<Response | undefined> {
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
      async () => jsonResponse(await handleCreateCart(client, body), { status: 201 }),
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
      async () => jsonResponse(await handleCreateCheckout(client, body, paymentHandlers), { status: 201 }),
    );
  }

  const checkoutMatch = /^\/checkout-sessions\/([^/]+)$/.exec(path);
  if (checkoutMatch && request.method === 'GET') {
    return jsonResponse(await handleGetCheckout(client, decodeURIComponent(checkoutMatch[1]), paymentHandlers));
  }
  if (checkoutMatch && request.method === 'PUT') {
    const body = await parseJsonBody<UCPCheckoutRequest>(request);
    return withRestIdempotency(
      request,
      sessionId,
      `REST PUT /checkout-sessions/${decodeURIComponent(checkoutMatch[1])}`,
      body,
      sessionStore,
      async () => jsonResponse(await handleUpdateCheckout(client, decodeURIComponent(checkoutMatch[1]), body, paymentHandlers)),
    );
  }

  const checkoutCompleteMatch = /^\/checkout-sessions\/([^/]+)\/complete$/.exec(path);
  if (checkoutCompleteMatch && request.method === 'POST') {
    return withRestIdempotency(
      request,
      sessionId,
      `REST POST /checkout-sessions/${decodeURIComponent(checkoutCompleteMatch[1])}/complete`,
      {},
      sessionStore,
      async () => jsonResponse(await handleCompleteCheckout(client, decodeURIComponent(checkoutCompleteMatch[1]), paymentHandlers)),
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
      async () => jsonResponse(createUCPError('not_implemented', 'Checkout cancellation is not represented by Reactionary checkout capabilities yet.'), { status: 501 }),
    );
  }

  const orderMatch = /^\/orders\/([^/]+)$/.exec(path);
  if (orderMatch && request.method === 'GET') {
    return jsonResponse(await handleGetOrder(client, decodeURIComponent(orderMatch[1])));
  }

  return undefined;
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

  const fingerprint = JSON.stringify(payload);
  const cached = await sessionStore.getIdempotencyRecord(sessionId, idempotencyKey);
  if (cached) {
    if (cached.action !== action || cached.fingerprint !== fingerprint) {
      return jsonResponse(createUCPError('idempotency_key_conflict', 'The supplied Idempotency-Key was already used for a different UCP REST mutation in this session.'), { status: 409 });
    }

    return jsonResponse(cached.response, { status: cached.status ?? 200 });
  }

  const response = await createResponse();
  const responseBody = await response.clone().json() as Record<string, unknown>;
  await sessionStore.putIdempotencyRecord(sessionId, idempotencyKey, {
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
      return createUCPError('cart_add_failed', `Unable to add item to cart: ${lineItem.item.id}`);
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

  const current = await client.cart.getById({ cart: { key: cartId } });
  const deleted = await client.cart.deleteCart({ cart: { key: cartId } });

  if (!deleted.success) {
    return createUCPError('cart_cancel_failed', `Unable to cancel cart: ${cartId}`);
  }

  return current.success ? toUcpCart(current.value) : createEmptyUcpCart(cartId);
}

async function handleCreateCheckout(
  client: ReactionaryUCPClient,
  body: UCPCheckoutRequest,
  paymentHandlers: UCPPaymentHandlers,
): Promise<UCPCheckoutResponse> {
  if (!client.checkout) {
    return createUCPError('not_available', 'Checkout capability is not available.');
  }

  const cart = body.cart_id
    ? await getReactionaryCart(client, body.cart_id)
    : await createCartForCheckout(client, body);

  if (!cart) {
    return createUCPError('invalid_request', 'A checkout session requires cart_id or line_items.');
  }

  const result = await client.checkout.initiateCheckoutForCart({ cart });

  if (!result.success) {
    return createUCPError('checkout_create_failed', 'Checkout session creation failed.');
  }

  return toUcpCheckout(result.value, paymentHandlers);
}

async function handleGetCheckout(
  client: ReactionaryUCPClient,
  checkoutId: string,
  paymentHandlers: UCPPaymentHandlers,
): Promise<UCPCheckoutResponse> {
  if (!client.checkout) {
    return createUCPError('not_available', 'Checkout capability is not available.');
  }

  const result = await client.checkout.getById({ identifier: { key: checkoutId } });

  if (!result.success) {
    return createUCPError('not_found', `Checkout was not found: ${checkoutId}`);
  }

  return toUcpCheckout(result.value, paymentHandlers);
}

async function handleUpdateCheckout(
  client: ReactionaryUCPClient,
  checkoutId: string,
  body: UCPCheckoutRequest,
  paymentHandlers: UCPPaymentHandlers,
): Promise<UCPCheckoutResponse> {
  if (!client.checkout) {
    return createUCPError('not_available', 'Checkout capability is not available.');
  }

  const current = await client.checkout.getById({ identifier: { key: checkoutId } });

  if (!current.success) {
    return createUCPError('not_found', `Checkout was not found: ${checkoutId}`);
  }

  let checkout = current.value;
  const selectedInstrument = body.payment?.instruments?.find((instrument) => instrument.selected);
  if (selectedInstrument) {
    const paymentResult = await client.checkout.addPaymentInstruction({
      checkout: checkout.identifier,
      paymentInstruction: {
        amount: checkout.price.grandTotal,
        paymentMethod: {
          method: selectedInstrument.type,
          name: selectedInstrument.id,
          paymentProcessor: selectedInstrument.handler_id,
        },
        protocolData: [
          { key: 'ucp_payment_instrument_id', value: selectedInstrument.id },
          { key: 'ucp_payment_handler_id', value: selectedInstrument.handler_id },
          { key: 'ucp_payment_instrument_type', value: selectedInstrument.type },
        ],
      },
    });

    if (!paymentResult.success) {
      return createUCPError('checkout_update_failed', 'Unable to add selected payment instruction.');
    }

    checkout = paymentResult.value;
  }

  return toUcpCheckout(checkout, paymentHandlers);
}

async function handleCompleteCheckout(
  client: ReactionaryUCPClient,
  checkoutId: string,
  paymentHandlers: UCPPaymentHandlers,
): Promise<UCPCheckoutResponse> {
  if (!client.checkout) {
    return createUCPError('not_available', 'Checkout capability is not available.');
  }

  const result = await client.checkout.finalizeCheckout({ checkout: { key: checkoutId } });

  if (!result.success) {
    return createUCPError('checkout_complete_failed', 'Checkout completion failed.');
  }

  return toUcpCheckout(result.value, paymentHandlers, 'completed');
}

async function handleGetOrder(
  client: ReactionaryUCPClient,
  orderId: string,
): Promise<UCPOrderResponse> {
  if (!client.order) {
    return createUCPError('not_available', 'Order capability is not available.');
  }

  const result = await client.order.getById({ order: { key: orderId } });

  if (!result.success) {
    return createUCPError('not_found', `Order was not found: ${orderId}`);
  }

  return {
    ucp: createUcpSuccessMetadata(),
    id: result.value.identifier.key,
    checkout_id: '',
    permalink_url: '',
    line_items: [],
    currency: getMoneyCurrency(result.value.price?.grandTotal),
    totals: toUcpCostTotals(result.value.price),
    fulfillment: {
      expectations: [],
      events: [],
    },
    messages: [],
  };
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

async function createCartForCheckout(
  client: ReactionaryUCPClient,
  checkout: UCPCheckout,
): Promise<Cart | undefined> {
  if (!checkout.line_items?.length) {
    return undefined;
  }

  const cartResponse = await handleCreateCart(client, {
    id: '',
    line_items: checkout.line_items,
    currency: checkout.currency,
    totals: checkout.totals,
    ucp: createUcpSuccessMetadata(),
  });

  return isUcpCart(cartResponse) ? getReactionaryCart(client, cartResponse.id) : undefined;
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

function toUcpCartLineItem(
  lineItem: Cart['items'][number] | Checkout['items'][number],
): UCPLineItem {
  const sku = lineItem.variant.sku || lineItem.identifier.key;

  return {
    id: lineItem.identifier.key,
    item: {
      id: sku,
      title: sku,
      price: getMoneyValue(lineItem.price.unitPrice),
    },
    quantity: lineItem.quantity,
    totals: toUcpTotals(lineItem.price.totalPrice),
  };
}

function toUcpCheckout(
  checkout: Checkout,
  paymentHandlers: UCPPaymentHandlers,
  status?: UCPCheckout['status'],
): UCPCheckout {
  return {
    id: checkout.identifier.key,
    status: status ?? (checkout.readyForFinalization ? 'ready_for_complete' : 'incomplete'),
    line_items: checkout.items.map(toUcpCartLineItem),
    currency: getMoneyCurrency(checkout.price?.grandTotal),
    totals: toUcpCostTotals(checkout.price),
    links: [],
    ucp: createUcpCheckoutSuccessMetadata(paymentHandlers),
  };
}

function toUcpDescription(
  text: string | undefined,
): components['schemas']['description'] {
  return text ? { plain: text } : { plain: '' };
}

function toUcpCostTotals(
  price: CostBreakDown,
): components['schemas']['total'][] {
  const totals: components['schemas']['total'][] = [
    { type: 'subtotal', amount: getMoneyValue(price.totalProductPrice) },
  ];
  const optionalTotals: Array<[string, number]> = [
    ['discount', -Math.abs(getMoneyValue(price.totalDiscount))],
    ['fulfillment', getMoneyValue(price.totalShipping)],
    ['tax', getMoneyValue(price.totalTax)],
    ['fee', getMoneyValue(price.totalSurcharge)],
  ];

  for (const [type, amount] of optionalTotals) {
    if (amount !== 0) {
      totals.push({ type, amount });
    }
  }

  totals.push({ type: 'total', amount: getMoneyValue(price.grandTotal) });

  return totals;
}

function toUcpTotals(
  amount: MonetaryAmount,
): components['schemas']['total'][] {
  return [
    {
      type: 'total',
      amount: getMoneyValue(amount),
    },
  ];
}

function getMoneyValue(
  amount: MonetaryAmount,
): number {
  return amount.value;
}

function getMoneyCurrency(
  amount: MonetaryAmount,
): string {
  return amount.currency;
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

function createUcpSuccessMetadata(): components['schemas']['ucp_$defs-base'] & { status: 'success' } {
  return {
    version: '2026-08-25',
    status: 'success',
  };
}

type UCPCheckoutPaymentHandlers = components['schemas']['response_checkout_schema']['payment_handlers'];

function createUcpCheckoutSuccessMetadata(
  paymentHandlers: UCPPaymentHandlers,
): components['schemas']['response_checkout_schema'] {
  const candidate: unknown = paymentHandlers;

  return {
    version: '2026-08-25',
    status: 'success',
    payment_handlers: isUcpCheckoutPaymentHandlers(candidate) ? candidate : {},
  };
}

// The generated handler type is unsatisfiable by object literals, so validate the runtime shape instead of casting.
function isUcpCheckoutPaymentHandlers(
  value: unknown,
): value is UCPCheckoutPaymentHandlers {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (handlers: unknown) =>
        Array.isArray(handlers) &&
        handlers.every(
          (handler: unknown) =>
            typeof handler === 'object' &&
            handler !== null &&
            typeof Reflect.get(handler, 'version') === 'string',
        ),
    )
  );
}

function createUCPError<TResponse>(
  code: string,
  message: string,
): TResponse {
  return {
    ucp: {
      version: '2026-08-25',
      status: 'error',
    },
    messages: [
      {
        message: {
          type: 'error',
          content_type: 'plain',
          content: message,
          code,
        },
      },
    ],
  } as TResponse;
}

function createUcpWarning(
  code: string,
  content: string,
  path: string,
): UCPMessage {
  return {
    type: 'warning',
    code,
    path,
    content,
    content_type: 'plain',
    presentation: 'notice',
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
