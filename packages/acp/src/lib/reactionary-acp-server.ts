import {
  createInitialRequestContext,
  getHttpProtocolResultAttributes,
  MemoryCache,
  traceProtocolInvocation,
  SessionSchema,
  type Cache,
  type Cart,
  type Checkout,
  type Inventory,
  type LanguageContext,
  type PaymentMethod,
  type Price,
  type Product,
  type ProductSearchResult,
  type RequestContext,
  type Result,
  type SearchIdentifier,
  type Session,
  type ShippingMethod,
} from '@reactionary/core';
import {
  ReactionaryFeedGenerator,
  acpProductFeedTransformer,
  type ReactionaryFeedInventoryOptions,
  type ReactionaryFeedProcessingOptions,
} from '@reactionary/feeds';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import {
  ACPCheckoutSessionStateSchema,
  ACPCompleteCheckoutSessionRequestSchema,
  ACPCreateCheckoutSessionRequestSchema,
  ACPUpdateCheckoutSessionRequestSchema,
  type ACPAddress,
  type ACPCheckoutSessionState,
  type ACPCompleteCheckoutSessionRequest,
  type ACPCreateCheckoutSessionRequest,
  type ACPItem,
  type ACPUpdateCheckoutSessionRequest,
} from './acp-schemas.js';

const ACP_SESSION_ID_HEADER = 'acp-session-id';
const SESSION_CACHE_KEY_PREFIX = 'reactionary:acp:session';
const CHECKOUT_SESSION_CACHE_KEY_PREFIX = 'reactionary:acp:checkout-session';
type ProtocolHeaders = Headers | Record<string, string>;

export interface ReactionaryACPClient {
  cart?: {
    createCart(payload: unknown): Promise<Result<Cart>>;
    add(payload: unknown): Promise<Result<Cart>>;
    getById(payload: unknown): Promise<Result<Cart>>;
    // Optional: used to discard transient pricing checkouts that are cart copies.
    deleteCart?(payload: unknown): Promise<Result<void>>;
  };
  checkout?: {
    initiateCheckoutForCart(payload: unknown): Promise<Result<Checkout>>;
    getById(payload: unknown): Promise<Result<Checkout>>;
    setShippingAddress(payload: unknown): Promise<Result<Checkout>>;
    getAvailableShippingMethods(payload: unknown): Promise<Result<ShippingMethod[]>>;
    getAvailablePaymentMethods(payload: unknown): Promise<Result<PaymentMethod[]>>;
    setShippingInstruction(payload: unknown): Promise<Result<Checkout>>;
    addPaymentInstruction(payload: unknown): Promise<Result<Checkout>>;
    finalizeCheckout(payload: unknown): Promise<Result<Checkout>>;
  };
  productSearch?: {
    queryByTerm(payload: unknown): Promise<Result<ProductSearchResult>>;
  };
  product?: {
    getBySKU(payload: unknown): Promise<Result<Product>>;
  };
  price?: {
    getListPrice(payload: unknown): Promise<Result<Price>>;
    getCustomerPrice(payload: unknown): Promise<Result<Price>>;
  };
  inventory?: {
    getBySKU(payload: unknown): Promise<Result<Inventory>>;
  };
}

type ValidatedReactionaryACPClient = ReactionaryACPClient & {
  cart: NonNullable<ReactionaryACPClient['cart']>;
  checkout: NonNullable<ReactionaryACPClient['checkout']>;
  productSearch: NonNullable<ReactionaryACPClient['productSearch']>;
  product: NonNullable<ReactionaryACPClient['product']>;
  price: NonNullable<ReactionaryACPClient['price']>;
  inventory: NonNullable<ReactionaryACPClient['inventory']>;
};

export type ReactionaryACPClientFactory<
  TClient extends ReactionaryACPClient = ReactionaryACPClient,
> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryACPServerOptions {
  name?: string;
  version?: string;
  basePath?: string;
  sessionCache?: Cache;
  sessionTtlSeconds?: number;
  checkoutSessionTtlSeconds?: number;
  paymentProvider?: ACPPaymentProvider;
  links?: ACPLink[];
  productFeed?: ACPProductFeedOptions;
  discovery?: ACPDiscoveryOptions;
  /**
   * Email used to price transient checkouts before the buyer has supplied
   * one. Never used for the real checkout created on completion.
   */
  placeholderEmail?: string;
  /**
   * How long checkout completion waits for an asynchronous payment
   * authorization (e.g. a PSP webhook) before answering `in_progress`.
   * Defaults to 10s timeout, polled every 1s; a timeout of 0 disables it.
   */
  paymentAuthorizationWait?: Partial<ACPPaymentAuthorizationWait>;
}

export const DEFAULT_ACP_PLACEHOLDER_EMAIL = 'pending@checkout.invalid';

export interface ACPPaymentAuthorizationWait {
  timeoutMs: number;
  intervalMs: number;
}

export const DEFAULT_ACP_PAYMENT_AUTHORIZATION_WAIT: ACPPaymentAuthorizationWait = {
  timeoutMs: 10_000,
  intervalMs: 1_000,
};

export interface ACPDiscoveryOptions {
  apiVersion?: string;
  supportedVersions?: string[];
  apiBaseUrl?: string;
  documentationUrl?: string;
  supportedCurrencies?: string[];
  supportedLocales?: string[];
}

export interface ACPDiscoveryResponse {
  protocol: {
    name: 'acp';
    version: string;
    supported_versions: string[];
    documentation_url?: string;
  };
  api_base_url: string;
  transports: ['rest'];
  capabilities: {
    services: Array<'checkout' | 'feeds'>;
    supported_currencies?: string[];
    supported_locales?: string[];
  };
}

const ACP_DISCOVERY_PATHS = ['/.well-known/acp.json', '/.well-known/acp'];
const ACP_DEFAULT_API_VERSION = '2026-01-30';

export type ACPPaymentProcessor = 'stripe' | 'adyen' | 'braintree';

export interface ACPPaymentProvider {
  provider: ACPPaymentProcessor;
  supported_payment_methods: ['card'];
}

export interface ACPLink {
  type: 'terms_of_use' | 'privacy_policy' | 'seller_shop_policies';
  url: string;
}

export interface ACPProductFeedOptions
  extends ReactionaryFeedInventoryOptions,
    ReactionaryFeedProcessingOptions {
  feeds: Record<string, ACPProductFeedDefinition>;
}

export interface ACPProductFeedDefinition {
  languageContext: LanguageContext;
  search: SearchIdentifier;
  pageSize?: number;
  maxPages?: number;
  productUrlBase?: string;
  fulfillmentCenterKeys?: string[];
  fulfillmentCenterKey?: string;
}

export interface ReactionaryACPHttpHandler {
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export type ReactionaryACPNodeRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

export class ReactionaryACPServer<
  TClient extends ReactionaryACPClient = ReactionaryACPClient,
> {
  private readonly sessionStore: ReactionaryACPSessionStore;
  private readonly checkoutSessionStore: ReactionaryACPCheckoutSessionStore;

  public constructor(
    private readonly clientFactory: ReactionaryACPClientFactory<TClient>,
    private readonly options: ReactionaryACPServerOptions = {},
  ) {
    this.sessionStore = new ReactionaryACPSessionStore(
      this.options.sessionCache ?? new MemoryCache(),
      this.options.sessionTtlSeconds ?? 60 * 60 * 24,
    );
    this.checkoutSessionStore = new ReactionaryACPCheckoutSessionStore(
      this.options.sessionCache ?? new MemoryCache(),
      this.options.checkoutSessionTtlSeconds ?? 60 * 60 * 24,
    );
    assertACPClient(this.clientFactory(createInitialRequestContext()));
  }

  public async fetch(request: Request): Promise<Response> {
    return traceProtocolInvocation(
      {
        protocol: 'acp',
        operation: `${request.method} ${getAcpOperationPath(request, this.options.basePath)}`,
        attributes: { 'http.request.method': request.method },
      },
      () => this.handleFetch(request),
      getHttpProtocolResultAttributes,
    );
  }

  private async handleFetch(request: Request): Promise<Response> {
    const sessionId = await this.resolveSessionId(request);
    const requestContext = await this.createRequestContext(sessionId);
    const requestedFeed = this.getRequestedProductFeed(request);

    if (requestedFeed) {
      requestContext.languageContext = requestedFeed.feed.languageContext;
    }

    const client = this.clientFactory(requestContext);
    assertACPClient(client);

    const response = await this.handleRequest(request, client, requestContext, sessionId)
      .catch((error: unknown) => toACPErrorResponse(error));
    await this.sessionStore.put(sessionId, requestContext.session);
    response.headers.set(ACP_SESSION_ID_HEADER, sessionId);

    return response;
  }

  /**
   * Requests addressing a checkout session resume the session that created
   * it: agents need not echo the ACP session header, but backends scope carts
   * to that session's (anonymous) identity.
   */
  private async resolveSessionId(request: Request): Promise<string> {
    const checkoutSessionId = getCheckoutSessionId(request, this.options.basePath);
    const state = checkoutSessionId
      ? await this.checkoutSessionStore.get(checkoutSessionId)
      : undefined;

    return state?.sessionId ?? getOrCreateSessionId(request);
  }

  public getHandler(): ReactionaryACPHttpHandler {
    return {
      fetch: (request) => this.fetch(request),
      close: () => this.close(),
    };
  }

  public toNodeHandler(): ReactionaryACPNodeRequestHandler {
    return async (request, response) => {
      const webResponse = await this.fetch(await toWebRequest(request));
      await sendWebResponse(response, webResponse);
    };
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  private async createRequestContext(
    sessionId: string,
  ): Promise<RequestContext> {
    const restoredSession = await this.sessionStore.get(sessionId);
    const requestContext = createInitialRequestContext();

    if (restoredSession) {
      requestContext.session = restoredSession;
    }

    return requestContext;
  }

  private async handleRequest(
    request: Request,
    client: ValidatedReactionaryACPClient,
    requestContext: RequestContext,
    sessionId: string,
  ): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          allow: 'GET, HEAD, OPTIONS, POST',
        },
      });
    }

    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      ACP_DISCOVERY_PATHS.includes(new URL(request.url).pathname)
    ) {
      return jsonResponse(this.getDiscoveryDocument(request), {
        headers: { 'cache-control': 'public, max-age=3600' },
        omitBody: request.method === 'HEAD',
      });
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const productFeedId = getProductFeedId(request, this.options.basePath);

      if (productFeedId) {
        const feed = this.getProductFeedDefinition(productFeedId);

        if (!feed) {
          return acpErrorResponse(404, {
            type: 'invalid_request',
            code: 'missing',
            message: `Product feed not found: ${productFeedId}`,
          });
        }

        return this.getProductFeed(
          request,
          productFeedId,
          feed,
          client,
          requestContext,
          request.method === 'HEAD',
        );
      }

      const checkoutSessionId = getCheckoutSessionId(
        request,
        this.options.basePath,
      );

      if (checkoutSessionId) {
        return this.getCheckoutSession(
          checkoutSessionId,
          client,
          request.method === 'HEAD',
        );
      }

      return jsonResponse(this.getReadinessDocument(), {
        omitBody: request.method === 'HEAD',
      });
    }

    if (request.method === 'POST') {
      return this.handlePost(request, client, requestContext, sessionId);
    }

    return jsonResponse({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Unsupported method: ${request.method}`,
      },
    }, {
      status: 405,
      headers: {
        allow: 'GET, HEAD, OPTIONS, POST',
      },
    });
  }

  private getDiscoveryDocument(request: Request): ACPDiscoveryResponse {
    const discovery = this.options.discovery ?? {};
    const version = discovery.apiVersion ?? ACP_DEFAULT_API_VERSION;
    const supportedVersions = discovery.supportedVersions ?? [version];
    const basePath = (this.options.basePath ?? '/acp').replace(/\/$/, '');
    const apiBaseUrl =
      discovery.apiBaseUrl ?? `${new URL(request.url).origin}${basePath}`;

    return {
      protocol: {
        name: 'acp',
        version,
        supported_versions: supportedVersions,
        ...(discovery.documentationUrl
          ? { documentation_url: discovery.documentationUrl }
          : {}),
      },
      api_base_url: apiBaseUrl,
      transports: ['rest'],
      capabilities: {
        services: this.options.productFeed ? ['checkout', 'feeds'] : ['checkout'],
        ...(discovery.supportedCurrencies
          ? { supported_currencies: discovery.supportedCurrencies }
          : {}),
        ...(discovery.supportedLocales
          ? { supported_locales: discovery.supportedLocales }
          : {}),
      },
    };
  }

  private getReadinessDocument(): Record<string, unknown> {
    return {
      name: this.options.name ?? '@reactionary/acp',
      version: this.options.version ?? '0.0.1',
      protocol: 'acp',
      status: 'ready',
      actions: [
        'POST /checkout_sessions',
        'POST /checkout_sessions/{checkout_session_id}',
        'GET /checkout_sessions/{checkout_session_id}',
        'POST /checkout_sessions/{checkout_session_id}/complete',
        'POST /checkout_sessions/{checkout_session_id}/cancel',
        'GET /product_feeds/{id}/products',
      ],
    };
  }

  private async getProductFeed(
    request: Request,
    feedId: string,
    feed: ACPProductFeedDefinition,
    client: ValidatedReactionaryACPClient,
    requestContext: RequestContext,
    omitBody: boolean,
  ): Promise<Response> {
    const format = new URL(request.url).searchParams.get('format') ?? 'json';

    if (format !== 'json' && format !== 'jsonl') {
      return acpErrorResponse(400, {
        type: 'invalid_request',
        code: 'invalid',
        message: `Unsupported product feed format: ${format}`,
        param: '$.format',
      });
    }

    const generator = new ReactionaryFeedGenerator(client, {
      defaultFulfillmentCenterKeys: this.options.productFeed?.defaultFulfillmentCenterKeys,
      productConcurrency: this.options.productFeed?.productConcurrency,
    });
    const output = acpProductFeedTransformer.transform(
      generator.products(feed, requestContext),
      {
        feedId,
        feed,
        options: { format },
      },
    );
    const extension = format === 'jsonl' ? 'jsonl' : 'json';

    return new Response(
      omitBody ? null : createFeedStream(output),
      {
        headers: {
          'content-type': format === 'jsonl'
            ? 'application/x-ndjson; charset=utf-8'
            : 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${feedId}.products.${extension}"`,
        },
      },
    );
  }

  private getRequestedProductFeed(
    request: Request,
  ): { id: string; feed: ACPProductFeedDefinition } | undefined {
    const id = getProductFeedId(request, this.options.basePath);
    const feed = id ? this.getProductFeedDefinition(id) : undefined;

    return id && feed ? { id, feed } : undefined;
  }

  private getProductFeedDefinition(
    feedId: string,
  ): ACPProductFeedDefinition | undefined {
    return this.options.productFeed?.feeds[feedId];
  }

  private async handlePost(
    request: Request,
    client: ValidatedReactionaryACPClient,
    requestContext: RequestContext,
    sessionId: string,
  ): Promise<Response> {
    const checkoutSessionId = getCheckoutSessionId(
      request,
      this.options.basePath,
    );

    if (!checkoutSessionId) {
      return this.createCheckoutSession(
        await parseJsonBody(request, ACPCreateCheckoutSessionRequestSchema),
        client,
        requestContext,
        sessionId,
      );
    }

    if (isCheckoutSessionCompleteRequest(request, this.options.basePath)) {
      return this.completeCheckoutSession(
        checkoutSessionId,
        await parseJsonBody(request, ACPCompleteCheckoutSessionRequestSchema),
        client,
      );
    }

    if (isCheckoutSessionCancelRequest(request, this.options.basePath)) {
      return this.cancelCheckoutSession(checkoutSessionId, client);
    }

    return this.updateCheckoutSession(
      checkoutSessionId,
      await parseJsonBody(request, ACPUpdateCheckoutSessionRequestSchema),
      client,
      requestContext,
    );
  }

  private async createCheckoutSession(
    input: ACPCreateCheckoutSessionRequest,
    client: ValidatedReactionaryACPClient,
    requestContext: RequestContext,
    sessionId: string,
  ): Promise<Response> {
    const cart = await this.createCartForItems(input.items, client);
    const state: ACPCheckoutSessionState = {
      id: `checkout_session_${crypto.randomUUID()}`,
      sessionId,
      cartId: cart.identifier.key,
      status: 'not_ready_for_payment',
      buyer: input.buyer,
      fulfillmentAddress: input.fulfillment_address,
    };

    return jsonResponse(
      await this.toACPCheckoutSession(state, client, requestContext),
      { status: 201 },
    );
  }

  private async updateCheckoutSession(
    checkoutSessionId: string,
    input: ACPUpdateCheckoutSessionRequest,
    client: ValidatedReactionaryACPClient,
    requestContext: RequestContext,
  ): Promise<Response> {
    const state = await this.getRequiredCheckoutSessionState(checkoutSessionId);

    if (state.checkoutId || state.status === 'canceled') {
      return acpErrorResponse(405, {
        type: 'invalid_request',
        code: 'invalid',
        message: 'The checkout session can no longer be modified.',
      });
    }

    const updatedState: ACPCheckoutSessionState = {
      ...state,
      cartId: input.items
        ? (await this.createCartForItems(input.items, client)).identifier.key
        : state.cartId,
      buyer: input.buyer ?? state.buyer,
      fulfillmentAddress: input.fulfillment_address ?? state.fulfillmentAddress,
      fulfillmentOptionId: input.fulfillment_option_id ?? state.fulfillmentOptionId,
    };

    return jsonResponse(
      await this.toACPCheckoutSession(updatedState, client, requestContext),
    );
  }

  private async getCheckoutSession(
    checkoutSessionId: string,
    client: ValidatedReactionaryACPClient,
    omitBody: boolean,
  ): Promise<Response> {
    const state = await this.checkoutSessionStore.get(checkoutSessionId);

    if (!state) {
      return acpErrorResponse(404, {
        type: 'invalid_request',
        code: 'missing',
        message: `Checkout session not found: ${checkoutSessionId}`,
      });
    }

    return jsonResponse(
      await this.toACPCheckoutSession(state, client),
      { omitBody },
    );
  }

  /**
   * Creates the real checkout from the session state and finalizes it. A
   * payment the PSP has not authorized yet leaves the session `in_progress`;
   * a repeated complete retries finalization.
   */
  private async completeCheckoutSession(
    checkoutSessionId: string,
    input: ACPCompleteCheckoutSessionRequest,
    client: ValidatedReactionaryACPClient,
  ): Promise<Response> {
    const state = await this.getRequiredCheckoutSessionState(checkoutSessionId);

    if (state.status === 'canceled') {
      return acpErrorResponse(405, {
        type: 'invalid_request',
        code: 'invalid',
        message: 'Canceled checkout sessions cannot be completed.',
      });
    }

    const buyer = input.buyer ?? state.buyer;
    let current: ACPCheckoutSessionState = { ...state, buyer };

    if (!current.checkoutId) {
      const view = await this.priceSession(current, client);

      if (view.status !== 'ready_for_payment') {
        return acpErrorResponse(400, {
          type: 'invalid_request',
          code: 'invalid',
          message: 'The checkout session is missing the buyer email, fulfillment address or fulfillment option.',
        });
      }

      const checkout = await this.placeCheckout(current, input, client);
      current = {
        ...current,
        checkoutId: checkout.identifier.key,
        status: 'in_progress',
      };
      await this.checkoutSessionStore.put(current.id, current);
    }

    if (current.status !== 'completed' && current.checkoutId) {
      const checkoutId = current.checkoutId;
      const wait = {
        ...DEFAULT_ACP_PAYMENT_AUTHORIZATION_WAIT,
        ...this.options.paymentAuthorizationWait,
      };
      const checkout = await pollUntil(
        () => unwrapACPResult(client.checkout.getById({ identifier: { key: checkoutId } })),
        (candidate) => Boolean(candidate.resultingOrder || candidate.readyForFinalization),
        wait,
      );

      if (checkout.resultingOrder) {
        current = { ...current, status: 'completed', orderId: checkout.resultingOrder.key };
      } else if (checkout.readyForFinalization) {
        const finalized = await unwrapACPResult(
          client.checkout.finalizeCheckout({ checkout: checkout.identifier }),
        );
        current = { ...current, status: 'completed', orderId: finalized.resultingOrder?.key };
      }
    }

    return jsonResponse(await this.toACPCheckoutSession(current, client));
  }

  private async cancelCheckoutSession(
    checkoutSessionId: string,
    client: ValidatedReactionaryACPClient,
  ): Promise<Response> {
    const state = await this.getRequiredCheckoutSessionState(checkoutSessionId);

    if (state.checkoutId || state.status === 'completed' || state.status === 'canceled') {
      return acpErrorResponse(405, {
        type: 'invalid_request',
        code: 'invalid',
        message: 'Completed or canceled checkout sessions cannot be canceled.',
      });
    }

    return jsonResponse(
      await this.toACPCheckoutSession({ ...state, status: 'canceled' }, client),
    );
  }

  private async createCartForItems(
    items: ACPItem[],
    client: ValidatedReactionaryACPClient,
  ): Promise<Cart> {
    let cart = await unwrapACPResult(client.cart.createCart({}));

    for (const item of items) {
      cart = await unwrapACPResult(
        client.cart.add({
          cart: cart.identifier,
          variant: { sku: item.id },
          quantity: item.quantity,
        }),
      );
    }

    return cart;
  }

  private async getRequiredCheckoutSessionState(
    checkoutSessionId: string,
  ): Promise<ACPCheckoutSessionState> {
    const state = await this.checkoutSessionStore.get(checkoutSessionId);

    if (!state) {
      throw new ACPHttpError(404, {
        type: 'invalid_request',
        code: 'missing',
        message: `Checkout session not found: ${checkoutSessionId}`,
      });
    }

    return state;
  }

  private async placeCheckout(
    state: ACPCheckoutSessionState,
    input: ACPCompleteCheckoutSessionRequest,
    client: ValidatedReactionaryACPClient,
  ): Promise<Checkout> {
    const cart = await unwrapACPResult(client.cart.getById({ cart: { key: state.cartId } }));
    let checkout = await unwrapACPResult(
      client.checkout.initiateCheckoutForCart({
        cart,
        billingAddress: state.fulfillmentAddress
          ? toReactionaryAddress(state.fulfillmentAddress)
          : undefined,
        notificationEmail: state.buyer?.email,
        notificationPhone: state.buyer?.phone_number,
      }),
    );

    if (state.fulfillmentOptionId) {
      checkout = await unwrapACPResult(
        client.checkout.setShippingInstruction(toShippingInstruction(checkout, state.fulfillmentOptionId)),
      );
    }

    return unwrapACPResult(
      client.checkout.addPaymentInstruction({
        checkout: checkout.identifier,
        paymentInstruction: {
          amount: checkout.price.grandTotal,
          paymentMethod: toPaymentMethodIdentifier(input.payment_data.provider),
          protocolData: [
            {
              key: 'delegated_payment_token',
              value: input.payment_data.token,
            },
          ],
        },
      }),
    );
  }

  /**
   * Prices the open session with a transient checkout, which is discarded
   * again: a reactionary checkout is a frozen snapshot, while an ACP session
   * keeps changing until completion. Backends need an email to quote, so a
   * placeholder stands in until the buyer supplies one.
   */
  private async priceSession(
    state: ACPCheckoutSessionState,
    client: ValidatedReactionaryACPClient,
  ): Promise<ACPSessionView> {
    const cart = await unwrapACPResult(client.cart.getById({ cart: { key: state.cartId } }));

    if (!state.fulfillmentAddress || state.status === 'canceled') {
      return { cart, price: cart.price, options: [], status: state.status === 'canceled' ? 'canceled' : 'not_ready_for_payment' };
    }

    let checkout = await unwrapACPResult(
      client.checkout.initiateCheckoutForCart({
        cart,
        billingAddress: toReactionaryAddress(state.fulfillmentAddress),
        notificationEmail: state.buyer?.email ?? this.options.placeholderEmail ?? DEFAULT_ACP_PLACEHOLDER_EMAIL,
        notificationPhone: state.buyer?.phone_number,
      }),
    );

    try {
      const shippingMethods = await client.checkout.getAvailableShippingMethods({ checkout: checkout.identifier });
      const options = shippingMethods.success ? shippingMethods.value : [];
      const selected = options.find((option) => option.identifier.key === state.fulfillmentOptionId);

      if (selected) {
        const withShipping = await client.checkout.setShippingInstruction(
          toShippingInstruction(checkout, selected.identifier.key),
        );
        checkout = withShipping.success ? withShipping.value : checkout;
      }

      const ready = Boolean(state.buyer?.email) && (options.length === 0 || Boolean(selected));

      return {
        cart,
        checkout,
        price: checkout.price,
        options,
        status: ready ? 'ready_for_payment' : 'not_ready_for_payment',
      };
    } finally {
      // Where the checkout is a copy of the cart (e.g. commercetools), the
      // copy would otherwise linger; where it is the cart itself, keep it.
      if (checkout.identifier.key !== cart.identifier.key && client.cart.deleteCart) {
        await client.cart.deleteCart({ cart: checkout.identifier });
      }
    }
  }

  private async toACPCheckoutSession(
    state: ACPCheckoutSessionState,
    client: ValidatedReactionaryACPClient,
    requestContext = createInitialRequestContext(),
  ): Promise<Record<string, unknown>> {
    const view = state.checkoutId
      ? await this.getPlacedView(state, client)
      : await this.priceSession(state, client);
    const persisted: ACPCheckoutSessionState = { ...state, status: view.status };

    await this.checkoutSessionStore.put(persisted.id, persisted);

    return {
      id: persisted.id,
      ...(persisted.buyer ? { buyer: persisted.buyer } : {}),
      payment_provider: await this.getPaymentProvider(view.checkout, client),
      status: persisted.status,
      currency: getCurrency(view.price, requestContext),
      line_items: (view.checkout?.items ?? view.cart?.items ?? []).map(toACPLineItem),
      ...(persisted.fulfillmentAddress
        ? { fulfillment_address: persisted.fulfillmentAddress }
        : {}),
      fulfillment_options: view.options.map(toACPFulfillmentOption),
      ...(persisted.fulfillmentOptionId
        ? { fulfillment_option_id: persisted.fulfillmentOptionId }
        : {}),
      totals: toACPTotals(view.price),
      ...(persisted.orderId
        ? {
            order: {
              id: persisted.orderId,
              checkout_session_id: persisted.id,
              permalink_url: '',
            },
          }
        : {}),
      messages: [],
      links: this.options.links ?? [],
    };
  }

  private async getPlacedView(
    state: ACPCheckoutSessionState,
    client: ValidatedReactionaryACPClient,
  ): Promise<ACPSessionView> {
    const checkout = await unwrapACPResult(
      client.checkout.getById({ identifier: { key: state.checkoutId ?? '' } }),
    );

    return {
      checkout,
      price: checkout.price,
      options: [],
      status: state.status === 'completed' || checkout.resultingOrder ? 'completed' : 'in_progress',
    };
  }

  private async getPaymentProvider(
    checkout: Checkout | undefined,
    client: ValidatedReactionaryACPClient,
  ): Promise<ACPPaymentProvider> {
    if (this.options.paymentProvider) {
      return this.options.paymentProvider;
    }

    const result = checkout
      ? await client.checkout.getAvailablePaymentMethods({
          checkout: checkout.identifier,
        })
      : undefined;

    if (result?.success) {
      const supported = result.value.find((method) =>
        ['stripe', 'adyen', 'braintree'].includes(
          method.identifier.paymentProcessor,
        ),
      );

      if (supported) {
        return {
          provider: supported.identifier
            .paymentProcessor as ACPPaymentProcessor,
          supported_payment_methods: ['card'],
        };
      }
    }

    return {
      provider: 'stripe',
      supported_payment_methods: ['card'],
    };
  }
}

interface ACPSessionView {
  cart?: Cart;
  checkout?: Checkout;
  price: Checkout['price'];
  options: ShippingMethod[];
  status: ACPCheckoutSessionState['status'];
}

function toShippingInstruction(
  checkout: Checkout,
  fulfillmentOptionId: string,
): { checkout: Checkout['identifier']; shippingInstruction: { shippingMethod: { key: string }; pickupPoint: string; instructions: string; consentForUnattendedDelivery: boolean } } {
  return {
    checkout: checkout.identifier,
    shippingInstruction: {
      shippingMethod: { key: fulfillmentOptionId },
      pickupPoint: '',
      instructions: '',
      consentForUnattendedDelivery: false,
    },
  };
}

async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  wait: ACPPaymentAuthorizationWait,
): Promise<T> {
  const deadline = Date.now() + wait.timeoutMs;
  let value = await read();

  while (!done(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait.intervalMs, Math.max(deadline - Date.now(), 0))));
    value = await read();
  }

  return value;
}

class ACPHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly body: ACPErrorBody,
  ) {
    super(body.message);
  }
}

interface ACPErrorBody {
  type: 'invalid_request' | 'processing_error' | 'service_unavailable';
  code: string;
  message: string;
  param?: string;
}

class ReactionaryACPSessionStore {
  public constructor(
    private readonly cache: Cache,
    private readonly ttlSeconds: number,
  ) {}

  public async get(sessionId: string): Promise<Session | undefined> {
    return (
      (await this.cache.get(
        this.getCacheKey(sessionId),
        SessionSchema,
      )) ?? undefined
    );
  }

  public async put(sessionId: string, session: Session): Promise<void> {
    await this.cache.invalidate([this.getDependencyId(sessionId)]);
    await this.cache.put(this.getCacheKey(sessionId), session, {
      ttlSeconds: this.ttlSeconds,
      dependencyIds: [this.getDependencyId(sessionId)],
    });
  }

  private getCacheKey(sessionId: string): string {
    return `${SESSION_CACHE_KEY_PREFIX}:${sessionId}`;
  }

  private getDependencyId(sessionId: string): string {
    return `${SESSION_CACHE_KEY_PREFIX}:${sessionId}`;
  }
}

class ReactionaryACPCheckoutSessionStore {
  public constructor(
    private readonly cache: Cache,
    private readonly ttlSeconds: number,
  ) {}

  public async get(
    checkoutSessionId: string,
  ): Promise<ACPCheckoutSessionState | undefined> {
    return (
      (await this.cache.get(
        this.getCacheKey(checkoutSessionId),
        ACPCheckoutSessionStateSchema,
      )) ?? undefined
    );
  }

  public async put(
    checkoutSessionId: string,
    session: ACPCheckoutSessionState,
  ): Promise<void> {
    await this.cache.invalidate([this.getDependencyId(checkoutSessionId)]);
    await this.cache.put(this.getCacheKey(checkoutSessionId), session, {
      ttlSeconds: this.ttlSeconds,
      dependencyIds: [this.getDependencyId(checkoutSessionId)],
    });
  }

  private getCacheKey(checkoutSessionId: string): string {
    return `${CHECKOUT_SESSION_CACHE_KEY_PREFIX}:${checkoutSessionId}`;
  }

  private getDependencyId(checkoutSessionId: string): string {
    return `${CHECKOUT_SESSION_CACHE_KEY_PREFIX}:${checkoutSessionId}`;
  }
}

function getSessionId(request: Request): string | undefined {
  return request.headers.get(ACP_SESSION_ID_HEADER) ?? undefined;
}

function getOrCreateSessionId(request: Request): string {
  return getSessionId(request) ?? crypto.randomUUID();
}

function getCheckoutSessionId(
  request: Request,
  basePath: string | undefined,
): string | undefined {
  const pathname = getProtocolPathname(request, basePath);
  const match = /^\/checkout_sessions\/([^/]+)(?:\/(?:complete|cancel))?$/.exec(
    pathname,
  );

  return match?.[1];
}

function getProductFeedId(
  request: Request,
  basePath: string | undefined,
): string | undefined {
  const pathname = getProtocolPathname(request, basePath);
  const match = /^\/product_feeds\/([^/]+)\/products$/.exec(pathname);

  return match?.[1];
}

function isCheckoutSessionCompleteRequest(
  request: Request,
  basePath: string | undefined,
): boolean {
  return getProtocolPathname(request, basePath).endsWith('/complete');
}

function isCheckoutSessionCancelRequest(
  request: Request,
  basePath: string | undefined,
): boolean {
  return getProtocolPathname(request, basePath).endsWith('/cancel');
}

function getProtocolPathname(
  request: Request,
  basePath = '/acp',
): string {
  const pathname = new URL(request.url).pathname;

  if (pathname === basePath) {
    return '/';
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }

  return pathname;
}

async function parseJsonBody<T>(
  request: Request,
  schema: { parse(value: unknown): T },
): Promise<T> {
  try {
    return schema.parse(await request.json());
  } catch (error) {
    throw new ACPHttpError(400, {
      type: 'invalid_request',
      code: 'invalid',
      message: error instanceof Error ? error.message : 'Invalid request body',
    });
  }
}

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    headers?: ProtocolHeaders;
    omitBody?: boolean;
  } = {},
): Response {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(
    options.omitBody ? null : JSON.stringify(body),
    {
      status: options.status ?? 200,
      headers,
    },
  );
}

function acpErrorResponse(status: number, body: ACPErrorBody): Response {
  return jsonResponse(body, { status });
}

function assertACPClient(
  client: ReactionaryACPClient,
): asserts client is ValidatedReactionaryACPClient {
  const missing = getMissingACPClientOperations(client);

  if (missing.length > 0) {
    throw new Error(
      `Reactionary ACP server cannot initialize because the client is missing required operations: ${missing.join(', ')}`,
    );
  }
}

function toACPErrorResponse(error: unknown): Response {
  if (error instanceof ACPHttpError) {
    return acpErrorResponse(error.status, error.body);
  }

  return acpErrorResponse(500, {
    type: 'processing_error',
    code: 'internal_error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function getMissingACPClientOperations(client: ReactionaryACPClient): string[] {
  return [
    ['cart.createCart', client.cart?.createCart],
    ['cart.add', client.cart?.add],
    ['cart.getById', client.cart?.getById],
    ['checkout.initiateCheckoutForCart', client.checkout?.initiateCheckoutForCart],
    ['checkout.getById', client.checkout?.getById],
    ['checkout.setShippingAddress', client.checkout?.setShippingAddress],
    ['checkout.getAvailableShippingMethods', client.checkout?.getAvailableShippingMethods],
    ['checkout.getAvailablePaymentMethods', client.checkout?.getAvailablePaymentMethods],
    ['checkout.setShippingInstruction', client.checkout?.setShippingInstruction],
    ['checkout.addPaymentInstruction', client.checkout?.addPaymentInstruction],
    ['checkout.finalizeCheckout', client.checkout?.finalizeCheckout],
    ['productSearch.queryByTerm', client.productSearch?.queryByTerm],
    ['product.getBySKU', client.product?.getBySKU],
    ['price.getListPrice', client.price?.getListPrice],
    ['price.getCustomerPrice', client.price?.getCustomerPrice],
    ['inventory.getBySKU', client.inventory?.getBySKU],
  ]
    .filter(([, operation]) => typeof operation !== 'function')
    .map(([name]) => name as string);
}

async function unwrapACPResult<T>(resultPromise: Promise<Result<T>>): Promise<T> {
  const result = await resultPromise;

  if (!result.success) {
    throw new ACPHttpError(400, {
      type: 'processing_error',
      code: 'reactionary_error',
      message: JSON.stringify(result.error),
    });
  }

  return result.value;
}

function getCurrency(
  price: Checkout['price'],
  requestContext: RequestContext,
): string {
  return (
    price.grandTotal.currency ??
    requestContext.languageContext.currencyCode
  ).toLowerCase();
}

function toACPLineItem(item: Checkout['items'][number] | Cart['items'][number]): Record<string, unknown> {
  const baseAmount = toMinorUnits(item.price.unitPrice.value * item.quantity);
  const discount = toMinorUnits(item.price.totalDiscount.value);
  const total = toMinorUnits(item.price.totalPrice.value);

  return {
    id: item.identifier.key,
    item: {
      id: item.variant.sku,
      quantity: item.quantity,
    },
    base_amount: baseAmount,
    discount,
    subtotal: Math.max(baseAmount - discount, 0),
    tax: 0,
    total,
  };
}

function toACPTotals(price: Checkout['price']): Record<string, unknown>[] {
  const base = toMinorUnits(price.totalProductPrice.value);
  const discount = toMinorUnits(price.totalDiscount.value);
  const subtotal = Math.max(base - discount, 0);
  const fulfillment = toMinorUnits(price.totalShipping.value);
  const tax = toMinorUnits(price.totalTax.value);
  const total = toMinorUnits(price.grandTotal.value);

  return [
    {
      type: 'items_base_amount',
      display_text: 'Item(s) total',
      amount: base,
    },
    {
      type: 'items_discount',
      display_text: 'Item discount',
      amount: discount,
    },
    {
      type: 'subtotal',
      display_text: 'Subtotal',
      amount: subtotal,
    },
    {
      type: 'fulfillment',
      display_text: 'Fulfillment',
      amount: fulfillment,
    },
    {
      type: 'tax',
      display_text: 'Tax',
      amount: tax,
    },
    {
      type: 'total',
      display_text: 'Total',
      amount: total,
    },
  ];
}

function toACPFulfillmentOption(
  method: ShippingMethod,
): Record<string, unknown> {
  const amount = toMinorUnits(method.price.value);

  return {
    type: 'shipping',
    id: method.identifier.key,
    title: method.name,
    subtitle: method.deliveryTime,
    carrier: method.carrier ?? '',
    earliest_delivery_time: new Date().toISOString(),
    latest_delivery_time: new Date().toISOString(),
    subtotal: amount,
    tax: 0,
    total: amount,
  };
}

function toReactionaryAddress(address: ACPAddress): {
  firstName: string;
  lastName: string;
  streetAddress: string;
  streetNumber: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
} {
  const [firstName, ...lastNameParts] = address.name.split(' ');

  return {
    firstName: firstName ?? address.name,
    lastName: lastNameParts.join(' '),
    streetAddress: address.line_one,
    streetNumber: '',
    city: address.city,
    region: address.state,
    postalCode: address.postal_code,
    countryCode: address.country,
  };
}

function toPaymentMethodIdentifier(
  provider: ACPPaymentProcessor,
): PaymentMethod['identifier'] {
  return {
    method: 'card',
    name: provider,
    paymentProcessor: provider,
  };
}

function toMinorUnits(value: number): number {
  return Math.max(Math.round(value * 100), 0);
}

function createFeedStream(
  chunks: AsyncIterable<string | Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = chunks[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();

      if (next.done) {
        controller.close();
        return;
      }

      controller.enqueue(
        typeof next.value === 'string' ? encoder.encode(next.value) : next.value,
      );
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = toWebHeaders(request.headers);
  const url = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? 'localhost'}`,
  );
  const body = await readNodeRequestBody(request);

  return new Request(url, {
    method: request.method,
    headers,
    body,
  });
}

function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        webHeaders.append(key, entry);
      }
      continue;
    }

    webHeaders.set(key, value);
  }

  return webHeaders;
}

async function readNodeRequestBody(
  request: IncomingMessage,
): Promise<Buffer | null> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  return Buffer.concat(chunks);
}

async function sendWebResponse(
  response: ServerResponse,
  webResponse: Response,
): Promise<void> {
  response.writeHead(
    webResponse.status,
    Object.fromEntries(webResponse.headers.entries()),
  );

  if (webResponse.body) {
    response.end(Buffer.from(await webResponse.arrayBuffer()));
    return;
  }

  response.end();
}

function getAcpOperationPath(request: Request, basePath: string | undefined): string {
  const pathname = getProtocolPathname(request, basePath);

  return pathname
    .replace(/^\/checkout_sessions\/[^/]+/, '/checkout_sessions/{id}')
    .replace(/^\/product_feeds\/[^/]+/, '/product_feeds/{id}');
}
