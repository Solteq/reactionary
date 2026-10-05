import {
  CurrencySchema,
  createInitialRequestContext,
  getHttpProtocolResultAttributes,
  MemoryCache,
  traceProtocolInvocation,
  SessionSchema,
  type Cache,
  type Cart,
  type Checkout,
  type Currency,
  type Inventory,
  type LanguageContext,
  type MonetaryAmount,
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
import { createHash, timingSafeEqual } from 'node:crypto';
import type * as z from 'zod';
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
  ACP_INTERVENTION_TYPES,
  type ACPAddress,
  type ACPAgentCapabilities,
  type ACPBuyer,
  type ACPInterventionType,
  type ACPPaymentData,
  type ACPCheckoutSessionState,
  type ACPCompleteCheckoutSessionRequest,
  type ACPCreateCheckoutSessionRequest,
  type ACPItem,
  type ACPUpdateCheckoutSessionRequest,
} from './acp-schemas.js';
import { ACPIdempotency, ACP_MIN_IDEMPOTENCY_TTL_SECONDS } from './acp-idempotency.js';
import {
  getHandlerPaymentMethod,
  type ACPPaymentHandlerOption,
} from './acp-payment-handlers.js';

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
    getAvailablePaymentMethods?(payload: unknown): Promise<Result<PaymentMethod[]>>;
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
  /**
   * How long Idempotency-Key responses are kept for replay. At least, and by
   * default, 24 hours (checkout RFC §6.6).
   */
  idempotencyTtlSeconds?: number;
  checkoutSessionTtlSeconds?: number;
  /**
   * Authenticates agents on checkout endpoints, e.g. by their
   * `Authorization: Bearer` token (see `createBearerTokenAuthenticator`) or a
   * request signature. Returning undefined answers 401. Checkout sessions are
   * visible only to the agent that created them. Unset, checkout endpoints
   * are open — the server logs a warning, as ACP requires authentication.
   */
  authenticate?: (request: Request) => ACPAgent | undefined | Promise<ACPAgent | undefined>;
  /**
   * The buyer-facing order page, as a URL template with an `{orderId}`
   * placeholder, e.g. `https://shop.example/account/orders/{orderId}`. Orders
   * MUST carry a permalink; without this option it is left out and a warning
   * is logged.
   */
  orderPermalinkUrl?: string;
  /**
   * Payment handlers advertised in `capabilities.payment.handlers`, e.g.
   * `createTokenizedCardHandler(...)`. Each maps to the backend payment
   * method its payments are placed with.
   */
  paymentHandlers?: ACPPaymentHandlerOption[];
  /**
   * Accepts raw card credentials (anything carrying a card number or CVC)
   * and forwards them to the backend's payment integration, which persists
   * payment data — putting the deployment in PCI DSS scope. Off by default:
   * such completions are rejected, as handlers are expected to submit
   * delegated tokens.
   */
  acceptRawCardCredentials?: boolean;
  links?: ACPLink[];
  productFeed?: ACPProductFeedOptions;
  discovery?: ACPDiscoveryOptions;
  /**
   * Email used to price transient checkouts before the buyer has supplied
   * one. Never used for the real checkout created on completion.
   */
  placeholderEmail?: string;
  /**
   * The interventions (e.g. 3DS) this seller can handle, and which it
   * requires. Sessions report the intersection with what the agent declared.
   * Defaults to none supported and none required.
   */
  interventions?: ACPInterventionOptions;
  /**
   * Checks line items against these fulfillment centers' combined stock,
   * reporting `out_of_stock` per line item. Unset, stock is left to the
   * backend.
   */
  inventory?: ACPInventoryOptions;
  /**
   * How long checkout completion waits for the placed checkout to become
   * `readyForFinalization` (i.e. its payment authorized, e.g. by a PSP
   * webhook) before answering `complete_in_progress`. Defaults to 10s timeout,
   * polled every 1s; a timeout of 0 disables it.
   */
  paymentAuthorizationWait?: Partial<ACPPaymentAuthorizationWait>;
}

export interface ACPInventoryOptions {
  fulfillmentCenterKeys: string[];
}

/** An authenticated agent (platform) calling the checkout API. */
export interface ACPAgent {
  id: string;
}

/**
 * Authenticates agents by `Authorization: Bearer <token>`, given each
 * agent's token. Tokens are compared in constant time.
 */
export function createBearerTokenAuthenticator(
  tokensByAgentId: Record<string, string>,
): (request: Request) => ACPAgent | undefined {
  const entries = Object.entries(tokensByAgentId);

  return (request) => {
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
    const token = match?.[1]?.trim();

    if (!token) {
      return undefined;
    }

    const agent = entries.find(([, candidate]) => secureEquals(candidate, token));

    return agent ? { id: agent[0] } : undefined;
  };
}

export interface ACPInterventionOptions {
  supported: ACPInterventionType[];
  required?: Array<'3ds' | 'biometric'>;
  /** When required interventions apply. Defaults to `conditional`. */
  enforcement?: 'always' | 'conditional' | 'optional';
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
  apiBaseUrl?: string;
  documentationUrl?: string;
  supportedCurrencies?: string[];
  /**
   * BCP 47 locales the backend can localize for. Advertised in discovery,
   * and checkout requests are localized to the best match of their
   * Accept-Language.
   */
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

/** The only ACP API version this adapter implements. */
export const ACP_API_VERSION = '2026-04-17';
const ACP_SUPPORTED_API_VERSIONS = [ACP_API_VERSION];
const ACP_API_VERSION_HEADER = 'api-version';



/** A policy or support link shown with the checkout (2026-04-17 Link). */
export interface ACPLink {
  type:
    | 'terms_of_use'
    | 'privacy_policy'
    | 'return_policy'
    | 'shipping_policy'
    | 'contact_us'
    | 'about_us'
    | 'faq'
    | 'support';
  /** Display text for the link. */
  title?: string;
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
  private readonly idempotency: ACPIdempotency;

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
    this.idempotency = new ACPIdempotency(
      this.options.sessionCache ?? new MemoryCache(),
      Math.max(this.options.idempotencyTtlSeconds ?? 0, ACP_MIN_IDEMPOTENCY_TTL_SECONDS),
    );
    assertACPClient(this.clientFactory(createInitialRequestContext()));
    assertPaymentHandlers(this.options.paymentHandlers ?? []);

    if (!this.options.orderPermalinkUrl) {
      console.warn('ACP: orders are returned without permalink_url; configure `orderPermalinkUrl` (ACP requires a permalink).');
    } else if (!this.options.orderPermalinkUrl.includes('{orderId}')) {
      throw new Error('ACP orderPermalinkUrl must contain an {orderId} placeholder.');
    }

    if (!this.options.authenticate) {
      console.warn('ACP: checkout endpoints are unauthenticated; configure `authenticate` (ACP requires agents to authenticate).');
    }
  }

  public async fetch(request: Request): Promise<Response> {
    return traceProtocolInvocation(
      {
        protocol: 'acp',
        operation: `${request.method} ${getAcpOperationPath(request, this.options.basePath)}`,
        attributes: { 'http.request.method': request.method },
      },
      async () => echoRequestHeaders(request, await this.handleFetch(request)),
      getHttpProtocolResultAttributes,
    );
  }

  private async handleFetch(request: Request): Promise<Response> {
    let agent: ACPAgent | undefined;

    try {
      agent = await this.authenticate(request);

      if (isCheckoutPost(request, this.options.basePath)) {
        assertSupportedApiVersion(request);
      }
    } catch (error) {
      return toACPErrorResponse(error);
    }

    const sessionId = await this.resolveSessionId(request);
    const requestContext = await this.createRequestContext(sessionId);
    const requestedFeed = this.getRequestedProductFeed(request);

    if (requestedFeed) {
      requestContext.languageContext = requestedFeed.feed.languageContext;
    }

    const locale = this.resolveLocale(request);

    if (locale && !requestedFeed) {
      requestContext.languageContext = { ...requestContext.languageContext, locale };
    }

    const currency = await this.resolveCheckoutCurrency(request);

    if (currency) {
      requestContext.languageContext = {
        ...requestContext.languageContext,
        currencyCode: currency,
      };
    }

    const client = this.clientFactory(requestContext);
    assertACPClient(client);

    const handle = () => this.handleRequest(request, client, requestContext, sessionId, agent)
      .catch((error: unknown) => toACPErrorResponse(error));
    const response = isCheckoutPost(request, this.options.basePath)
      ? await this.idempotency.run(request, agent?.id ?? 'anonymous', handle)
      : await handle();
    await this.sessionStore.put(sessionId, requestContext.session);
    response.headers.set(ACP_SESSION_ID_HEADER, sessionId);

    return response;
  }

  /**
   * Checkout endpoints require an authenticated agent (checkout RFC §3.1),
   * and a checkout session is visible only to the agent that created it, so
   * another agent's session is reported as missing. Discovery and the
   * readiness document stay public.
   */
  private async authenticate(request: Request): Promise<ACPAgent | undefined> {
    const pathname = getProtocolPathname(request, this.options.basePath);

    if (!this.options.authenticate || !pathname.startsWith('/checkout_sessions')) {
      return undefined;
    }

    const agent = await this.options.authenticate(request);

    if (!agent) {
      throw new ACPHttpError(401, {
        type: 'invalid_request',
        code: 'unauthorized',
        message: 'A valid Authorization bearer token is required.',
      }, { 'www-authenticate': 'Bearer' });
    }

    const checkoutSessionId = getCheckoutSessionId(request, this.options.basePath);
    const state = checkoutSessionId ? await this.checkoutSessionStore.get(checkoutSessionId) : undefined;

    if (state?.agentId !== undefined && state.agentId !== agent.id) {
      throw new ACPHttpError(404, {
        type: 'invalid_request',
        code: 'missing',
        message: `Checkout session not found: ${checkoutSessionId}`,
      });
    }

    return agent;
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

  /**
   * The best supported locale for the request's Accept-Language: an exact
   * tag, else one of the same language. Only locales advertised in
   * `discovery.supportedLocales` are used, as backends may not localize
   * others.
   */
  private resolveLocale(request: Request): string | undefined {
    const supported = this.options.discovery?.supportedLocales ?? [];
    const requested = parseAcceptLanguage(request.headers.get('accept-language'));

    for (const tag of requested) {
      const exact = supported.find((locale) => locale.toLowerCase() === tag.toLowerCase());
      const sameLanguage = supported.find(
        (locale) => locale.split('-')[0]?.toLowerCase() === tag.split('-')[0]?.toLowerCase(),
      );

      if (exact ?? sameLanguage) {
        return exact ?? sameLanguage;
      }
    }

    return undefined;
  }

  /**
   * The currency a checkout session is priced in: the one requested on its
   * creation, which later requests for the session keep using.
   */
  private async resolveCheckoutCurrency(request: Request): Promise<Currency | undefined> {
    const checkoutSessionId = getCheckoutSessionId(request, this.options.basePath);
    let currency: unknown;

    if (checkoutSessionId) {
      currency = (await this.checkoutSessionStore.get(checkoutSessionId))?.currency;
    } else if (request.method === 'POST' && getProtocolPathname(request, this.options.basePath) === '/checkout_sessions') {
      const body: unknown = await request.clone().json().catch(() => undefined);
      currency = typeof body === 'object' && body !== null ? Reflect.get(body, 'currency') : undefined;
    }

    const parsed = CurrencySchema.safeParse(typeof currency === 'string' ? currency.toUpperCase() : undefined);

    return parsed.success ? parsed.data : undefined;
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
    agent: ACPAgent | undefined,
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
        assertSupportedApiVersion(request);

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
      assertSupportedApiVersion(request);

      return this.handlePost(request, client, requestContext, sessionId, agent);
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
    const basePath = (this.options.basePath ?? '/acp').replace(/\/$/, '');
    const apiBaseUrl =
      discovery.apiBaseUrl ?? `${new URL(request.url).origin}${basePath}`;

    return {
      protocol: {
        name: 'acp',
        version: ACP_API_VERSION,
        supported_versions: ACP_SUPPORTED_API_VERSIONS,
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
    agent: ACPAgent | undefined,
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
        agent,
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
    agent: ACPAgent | undefined,
  ): Promise<Response> {
    const cart = await this.createCartForItems(input.line_items, client);
    const state: ACPCheckoutSessionState = {
      id: `checkout_session_${crypto.randomUUID()}`,
      sessionId,
      ...(agent ? { agentId: agent.id } : {}),
      cartId: cart.identifier.key,
      currency: input.currency.toLowerCase(),
      agentCapabilities: input.capabilities,
      status: 'not_ready_for_payment',
      buyer: input.buyer,
      fulfillmentDetails: input.fulfillment_details,
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
      cartId: input.line_items
        ? (await this.createCartForItems(input.line_items, client)).identifier.key
        : state.cartId,
      buyer: mergeBuyer(state.buyer, input.buyer),
      fulfillmentDetails: input.fulfillment_details === null
        ? undefined
        : input.fulfillment_details ?? state.fulfillmentDetails,
      fulfillmentOptionId: input.selected_fulfillment_options === undefined
        ? state.fulfillmentOptionId
        : input.selected_fulfillment_options?.[0]?.option_id,
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
   * payment the PSP has not authorized yet leaves the session
   * `complete_in_progress`, without an order yet;
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

    const buyer = mergeBuyer(state.buyer, input.buyer);
    let current: ACPCheckoutSessionState = { ...state, buyer };

    if (!current.checkoutId) {
      const handler = this.resolvePaymentHandler(input.payment_data);
      const view = await this.priceSession(current, client);

      if (view.status !== 'ready_for_payment') {
        const blocking = view.messages?.find((message) => message.type === 'error');

        return acpErrorResponse(400, {
          type: 'invalid_request',
          code: blocking?.code ?? 'invalid',
          message: blocking?.content ?? 'The checkout session is not ready for payment.',
          ...(blocking?.param ? { param: blocking.param } : {}),
        });
      }

      const checkout = await this.placeCheckout(current, input, handler, client);

      if (!checkout) {
        // A declined payment leaves the session payable with another
        // instrument (lifecycle: in_progress → ready_for_payment).
        return jsonResponse(await this.toACPCheckoutSession(current, client, undefined, [{
          type: 'error',
          code: 'payment_declined',
          param: '$.payment_data',
          content_type: 'plain',
          content: 'The payment was declined. Please try a different payment method.',
          resolution: 'requires_buyer_input',
        }]));
      }

      current = {
        ...current,
        checkoutId: checkout.identifier.key,
        status: 'complete_in_progress',
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

      const orderId = checkout.resultingOrder?.key ?? (checkout.readyForFinalization
        ? (await unwrapACPResult(client.checkout.finalizeCheckout({ checkout: checkout.identifier }))).resultingOrder?.key
        : undefined);

      // Completed always comes with the order (CheckoutSessionWithOrder).
      if (orderId) {
        current = { ...current, status: 'completed', orderId };
      }
    }

    const pending: ACPMessage[] = current.status === 'completed'
      ? []
      : [{
          type: 'info',
          content_type: 'plain',
          content: 'The payment is awaiting authorization. Retrieve the session, or complete it again with a new Idempotency-Key, to receive the order.',
        }];

    return jsonResponse(await this.toACPCheckoutSession(current, client, undefined, pending));
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
    const quantities = new Map<string, { quantity: number; index: number }>();

    for (const [index, item] of items.entries()) {
      const current = quantities.get(item.id);
      quantities.set(item.id, { quantity: (current?.quantity ?? 0) + (item.quantity ?? 1), index: current?.index ?? index });
    }

    for (const [sku, { quantity, index }] of quantities) {
      cart = await unwrapACPResult(
        client.cart.add({
          cart: cart.identifier,
          variant: { sku },
          quantity,
        }),
        `$.line_items[${index}].id`,
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
    handler: ACPPaymentHandlerOption,
    client: ValidatedReactionaryACPClient,
  ): Promise<Checkout | undefined> {
    const cart = await unwrapACPResult(client.cart.getById({ cart: { key: state.cartId } }));
    const address = state.fulfillmentDetails?.address;
    const billingAddress = input.payment_data.billing_address ?? address;
    let checkout = await unwrapACPResult(
      client.checkout.initiateCheckoutForCart({
        cart,
        billingAddress: billingAddress ? toReactionaryAddress(billingAddress) : undefined,
        notificationEmail: getContactEmail(state),
        notificationPhone: getContactPhone(state),
      }),
    );

    if (address) {
      checkout = await unwrapACPResult(
        client.checkout.setShippingAddress({ checkout: checkout.identifier, shippingAddress: toReactionaryAddress(address) }),
      );
    }

    if (state.fulfillmentOptionId) {
      checkout = await unwrapACPResult(
        client.checkout.setShippingInstruction(toShippingInstruction(checkout, state.fulfillmentOptionId)),
      );
    }

    // The delegated token is passed verbatim; the backend's payment
    // integration for the provider confirms the payment with it.
    const paid = await client.checkout.addPaymentInstruction({
      checkout: checkout.identifier,
      paymentInstruction: {
        amount: checkout.price.grandTotal,
        paymentMethod: getHandlerPaymentMethod(handler),
        protocolData: [
          {
            key: 'delegated_payment_token',
            value: input.payment_data.instrument.credential.token,
          },
          {
            key: 'delegated_payment_provider',
            value: handler.handler.psp,
          },
          { key: 'acp_payment_handler_id', value: handler.handler.id },
          { key: 'acp_payment_instrument_type', value: input.payment_data.instrument.type },
          { key: 'acp_payment_credential_type', value: input.payment_data.instrument.credential.type },
        ],
      },
    });

    if (!paid.success) {
      // The declined checkout is discarded where it is a copy of the cart.
      if (checkout.identifier.key !== cart.identifier.key && client.cart.deleteCart) {
        await client.cart.deleteCart({ cart: checkout.identifier });
      }

      return undefined;
    }

    return paid.value;
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

    if (state.status === 'canceled') {
      return { cart, price: cart.price, options: [], messages: [], status: 'canceled' };
    }

    const stockMessages = await this.getStockMessages(cart, client);
    const address = state.fulfillmentDetails?.address;

    if (!address) {
      return {
        cart,
        price: cart.price,
        options: [],
        messages: [...stockMessages, ...getInputMessages(state, [], false)],
        status: 'not_ready_for_payment',
      };
    }

    let checkout = await unwrapACPResult(
      client.checkout.initiateCheckoutForCart({
        cart,
        billingAddress: toReactionaryAddress(address),
        notificationEmail: getContactEmail(state) ?? this.options.placeholderEmail ?? DEFAULT_ACP_PLACEHOLDER_EMAIL,
        notificationPhone: getContactPhone(state),
      }),
    );

    try {
      const withAddress = await client.checkout.setShippingAddress({
        checkout: checkout.identifier,
        shippingAddress: toReactionaryAddress(address),
      });
      checkout = withAddress.success ? withAddress.value : checkout;

      const shippingMethods = await client.checkout.getAvailableShippingMethods({ checkout: checkout.identifier });
      const options = shippingMethods.success ? shippingMethods.value : [];
      const selected = options.find((option) => option.identifier.key === state.fulfillmentOptionId);

      if (selected) {
        const withShipping = await client.checkout.setShippingInstruction(
          toShippingInstruction(checkout, selected.identifier.key),
        );
        checkout = withShipping.success ? withShipping.value : checkout;
      }

      const messages = [
        ...stockMessages,
        ...this.getInterventionMessages(state),
        ...getInputMessages(state, options, true),
      ];
      const ready = messages.every((message) => message.type !== 'error');

      return {
        messages,
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
    /** Messages about this request only, e.g. a declined payment. */
    extraMessages: ACPMessage[] = [],
  ): Promise<Record<string, unknown>> {
    const view = state.checkoutId
      ? await this.getPlacedView(state, client)
      : await this.priceSession(state, client);
    const persisted: ACPCheckoutSessionState = {
      ...state,
      status: view.status,
      ...(view.orderId ? { orderId: view.orderId } : {}),
    };
    const lineItems = view.checkout?.items ?? view.cart?.items ?? [];
    const products = await getProducts(lineItems.map((item) => item.variant.sku), client);
    const optionTitles = getOptionTitles(view.options);

    await this.checkoutSessionStore.put(persisted.id, persisted);

    return {
      id: persisted.id,
      protocol: { version: ACP_API_VERSION },
      capabilities: this.getNegotiatedCapabilities(persisted.agentCapabilities),
      ...(persisted.buyer ? { buyer: persisted.buyer } : {}),
      status: persisted.status,
      currency: getCurrency(view.price, requestContext),
      line_items: lineItems.map((item) => toACPLineItem(item, products.get(item.variant.sku))),
      ...(persisted.fulfillmentDetails
        ? { fulfillment_details: persisted.fulfillmentDetails }
        : {}),
      fulfillment_options: view.options.map((option) =>
        toACPFulfillmentOption(option, optionTitles.get(option.identifier.key) ?? option.identifier.key)),
      ...(persisted.fulfillmentOptionId
        ? {
            selected_fulfillment_options: [{
              type: 'shipping',
              option_id: persisted.fulfillmentOptionId,
              item_ids: lineItems.map((lineItem) => lineItem.identifier.key),
            }],
          }
        : {}),
      totals: toACPTotals(view.price),
      ...(persisted.orderId
        ? {
            order: {
              type: 'order',
              id: persisted.orderId,
              checkout_session_id: persisted.id,
              ...(this.options.orderPermalinkUrl
                ? { permalink_url: toOrderPermalinkUrl(this.options.orderPermalinkUrl, persisted.orderId) }
                : {}),
            },
          }
        : {}),
      messages: [...extraMessages, ...(view.messages ?? [])],
      links: this.options.links ?? [],
    };
  }

  /**
   * The advertised handler a completion pays with. Sellers MUST check the
   * handler is one they declared (sellers guide, "Complete a checkout
   * session"), and raw card numbers are refused unless explicitly accepted,
   * so they never reach the backend's persisted payment data.
   */
  private resolvePaymentHandler(paymentData: ACPPaymentData): ACPPaymentHandlerOption {
    const option = this.options.paymentHandlers?.find((candidate) => candidate.handler.id === paymentData.handler_id);

    if (!option) {
      throw new ACPHttpError(400, {
        type: 'invalid_request',
        code: 'invalid',
        message: `Payment handler '${paymentData.handler_id}' is not offered for this checkout.`,
        param: '$.payment_data.handler_id',
      });
    }

    if (!this.options.acceptRawCardCredentials && isRawCardCredential(paymentData.instrument.credential)) {
      throw new ACPHttpError(400, {
        type: 'invalid_request',
        code: 'invalid',
        message: 'Raw card credentials are not accepted; submit a delegated payment token instead.',
        param: '$.payment_data.instrument.credential',
      });
    }

    return option;
  }

  /**
   * The seller's capabilities for a session: interventions are the
   * intersection of what the agent declared and what the seller supports,
   * plus the seller's requirements (capability negotiation RFC §4.5.1).
   */
  private getNegotiatedCapabilities(agent: ACPAgentCapabilities | undefined): Record<string, unknown> {
    const seller = this.options.interventions;
    const required = seller?.required ?? [];

    const handlers = this.options.paymentHandlers ?? [];

    return {
      ...(handlers.length > 0
        ? { payment: { handlers: handlers.map((option) => option.handler) } }
        : {}),
      interventions: {
        supported: getSupportedInterventions(agent, seller),
        ...(required.length > 0
          ? { required, enforcement: seller?.enforcement ?? 'conditional' }
          : {}),
      },
    };
  }

  /**
   * An out_of_stock error per line item requesting more than the configured
   * fulfillment centers hold (as in the UCP adapter). Back-ordered and
   * pre-ordered items are always purchasable; without configured centers,
   * stock is left to the backend.
   */
  private async getStockMessages(cart: Cart, client: ValidatedReactionaryACPClient): Promise<ACPMessage[]> {
    const fulfillmentCenterKeys = this.options.inventory?.fulfillmentCenterKeys ?? [];

    if (fulfillmentCenterKeys.length === 0) {
      return [];
    }

    const messages = await Promise.all(cart.items.map(async (item, index): Promise<ACPMessage | undefined> => {
      const results = await Promise.all(fulfillmentCenterKeys.map((key) => client.inventory.getBySKU({
        variant: item.variant,
        fulfilmentCenter: { key },
      })));
      const inventories = results.flatMap((result) => (result.success ? [result.value] : []));

      if (
        inventories.length === 0
        || inventories.some((inventory) => inventory.status === 'onBackOrder' || inventory.status === 'preOrder')
      ) {
        return undefined;
      }

      const available = inventories.reduce(
        (total, inventory) => total + (inventory.status === 'inStock' ? Math.max(inventory.quantity, 0) : 0),
        0,
      );

      if (item.quantity <= available) {
        return undefined;
      }

      const sku = item.variant.sku;

      return {
        type: 'error',
        code: 'out_of_stock',
        param: `$.line_items[${index}]`,
        content_type: 'plain',
        content: available > 0 ? `Only ${available} of ${sku} are in stock.` : `${sku} is out of stock.`,
        resolution: 'requires_buyer_input',
      };
    }));

    return messages.filter((message) => message !== undefined);
  }

  /**
   * Required interventions the agent cannot perform block the session when
   * they always apply (checkout RFC §5, intervention_required).
   */
  private getInterventionMessages(state: ACPCheckoutSessionState): ACPMessage[] {
    const seller = this.options.interventions;
    const supported = getSupportedInterventions(state.agentCapabilities, seller);
    const missing = (seller?.required ?? []).filter((type) => !supported.includes(type));

    if (missing.length === 0 || seller?.enforcement !== 'always') {
      return [];
    }

    return [{
      type: 'error',
      code: 'intervention_required',
      param: '$.capabilities.interventions',
      content_type: 'plain',
      content: `This checkout requires ${missing.join(', ')}, which the agent does not support.`,
    }];
  }

  private async getPlacedView(
    state: ACPCheckoutSessionState,
    client: ValidatedReactionaryACPClient,
  ): Promise<ACPSessionView> {
    const checkout = await unwrapACPResult(
      client.checkout.getById({ identifier: { key: state.checkoutId ?? '' } }),
    );

    // The backend may have finalized the order since (e.g. on the PSP's
    // authorization webhook), which retrieval picks up.
    const orderId = state.orderId ?? checkout.resultingOrder?.key;

    return {
      checkout,
      price: checkout.price,
      options: [],
      status: orderId ? 'completed' : 'complete_in_progress',
      ...(orderId ? { orderId } : {}),
    };
  }
}

interface ACPSessionView {
  messages?: ACPMessage[];
  /** The order a placed checkout resulted in. */
  orderId?: string;
  cart?: Cart;
  checkout?: Checkout;
  price: Checkout['price'];
  options: ShippingMethod[];
  status: ACPCheckoutSessionState['status'];
}

/** The products of the given SKUs, for line item display fields. */
async function getProducts(
  skus: string[],
  client: ValidatedReactionaryACPClient,
): Promise<Map<string, Product>> {
  const products = new Map<string, Product>();

  await Promise.all([...new Set(skus)].map(async (sku) => {
    const result = await client.product.getBySKU({ variant: { sku } });

    if (result.success) {
      products.set(sku, result.value);
    }
  }));

  return products;
}

/** Constant-time string comparison (as in the UCP adapter). */
function secureEquals(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();

  return timingSafeEqual(leftDigest, rightDigest);
}

/** A credential carrying card account data rather than a token. */
function isRawCardCredential(credential: Record<string, unknown>): boolean {
  return credential['type'] === 'card'
    || credential['type'] === 'pan'
    || ['number', 'cvc', 'card_number'].some((field) => credential[field] !== undefined);
}

interface ACPMessage {
  type: 'info' | 'warning' | 'error';
  code?: string;
  param?: string;
  content_type: 'plain' | 'markdown';
  content: string;
  /** Who resolves it: the agent via the API, or the buyer. */
  resolution?: 'recoverable' | 'requires_buyer_input' | 'requires_buyer_review';
}

/**
 * What the session still needs before payment: each missing or invalid
 * input as an error message at its JSONPath, so the agent can ask the buyer
 * or correct its request.
 */
function getInputMessages(
  state: ACPCheckoutSessionState,
  options: ShippingMethod[],
  hasAddress: boolean,
): ACPMessage[] {
  const messages: ACPMessage[] = [];
  const missing = (param: string, content: string): ACPMessage => ({
    type: 'error',
    code: 'missing',
    param,
    content_type: 'plain',
    content,
    resolution: 'requires_buyer_input',
  });

  if (!getContactEmail(state)) {
    messages.push(missing('$.buyer.email', 'A buyer email is required.'));
  }

  if (!hasAddress) {
    messages.push(missing('$.fulfillment_details.address', 'A shipping address is required.'));
  }

  const selected = options.some((option) => option.identifier.key === state.fulfillmentOptionId);

  if (state.fulfillmentOptionId && hasAddress && !selected) {
    messages.push({
      type: 'error',
      code: 'invalid',
      param: '$.selected_fulfillment_options[0].option_id',
      content_type: 'plain',
      content: `Fulfillment option '${state.fulfillmentOptionId}' is not available for this checkout.`,
      resolution: 'recoverable',
    });
  } else if (options.length > 0 && !state.fulfillmentOptionId) {
    messages.push(missing('$.selected_fulfillment_options', 'A fulfillment option must be selected.'));
  }

  return messages;
}

function getSupportedInterventions(
  agent: ACPAgentCapabilities | undefined,
  seller: ACPInterventionOptions | undefined,
): ACPInterventionType[] {
  const declared = new Set(agent?.interventions?.supported ?? []);

  return (seller?.supported ?? []).filter(
    (type) => ACP_INTERVENTION_TYPES.includes(type) && declared.has(type),
  );
}

/**
 * The buyer's contact details, falling back to the fulfillment contact
 * (marketing consent RFC §3.5 resolves contacts the same way).
 */
function getContactEmail(state: ACPCheckoutSessionState): string | undefined {
  return state.buyer?.email ?? state.fulfillmentDetails?.email;
}

function getContactPhone(state: ACPCheckoutSessionState): string | undefined {
  return state.buyer?.phone_number ?? state.fulfillmentDetails?.phone_number;
}

/** Buyer updates refine what the session already knows about the buyer. */
function mergeBuyer(
  current: ACPBuyer | undefined,
  update: ACPBuyer | undefined,
): ACPBuyer | undefined {
  return update ? { ...current, ...update } : current;
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
    public readonly headers: Record<string, string> = {},
  ) {
    super(body.message);
  }
}

interface ACPErrorBody {
  type: 'invalid_request' | 'processing_error' | 'service_unavailable';
  code: string;
  message: string;
  param?: string;
  supported_versions?: string[];
}

/**
 * Agents MUST send API-Version and servers MUST validate it; rejections list
 * the supported versions (checkout RFC §2.1).
 */
function assertSupportedApiVersion(request: Request): void {
  const version = request.headers.get(ACP_API_VERSION_HEADER);

  if (version && ACP_SUPPORTED_API_VERSIONS.includes(version)) {
    return;
  }

  throw new ACPHttpError(400, {
    type: 'invalid_request',
    code: version ? 'unsupported_api_version' : 'missing_api_version',
    message: version
      ? `API version '${version}' is not supported.`
      : 'The API-Version header is required.',
    supported_versions: ACP_SUPPORTED_API_VERSIONS,
  });
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

function toOrderPermalinkUrl(template: string, orderId: string): string {
  return template.replaceAll('{orderId}', encodeURIComponent(orderId));
}

/** Responses echo Request-Id and, on POSTs, Idempotency-Key (checkout RFC §3.1). */
function echoRequestHeaders(request: Request, response: Response): Response {
  const requestId = request.headers.get('request-id');
  const idempotencyKey = request.headers.get('idempotency-key');

  if (requestId) {
    response.headers.set('request-id', requestId);
  }

  if (idempotencyKey && request.method === 'POST') {
    response.headers.set('idempotency-key', idempotencyKey);
  }

  return response;
}

/** Accept-Language tags by descending quality, e.g. `fi-FI,en;q=0.5` → fi-FI, en. */
function parseAcceptLanguage(header: string | null): string[] {
  return (header ?? '')
    .split(',')
    .map((part, index) => {
      const [tag = '', ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([0-9.]+)\s*$/.exec(parameter)?.[1])
        .find((value) => value !== undefined);

      return { tag: tag.trim(), quality: quality === undefined ? 1 : Number(quality), index };
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)
    .map((entry) => entry.tag);
}

/** POSTs to checkout endpoints, which all require an Idempotency-Key. */
function isCheckoutPost(request: Request, basePath: string | undefined): boolean {
  return request.method === 'POST'
    && getProtocolPathname(request, basePath).startsWith('/checkout_sessions');
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
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ACPHttpError(400, {
      type: 'invalid_request',
      code: 'invalid_json',
      message: 'The request body must be valid JSON.',
    });
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    throw new ACPHttpError(400, {
      type: 'invalid_request',
      code: issue?.code === 'invalid_type' && /received undefined/.test(issue.message) ? 'missing' : 'invalid',
      message: issue?.message ?? 'Invalid request body',
      ...(issue ? { param: toJsonPath(issue.path) } : {}),
    });
  }

  return parsed.data;
}

/** An RFC 9535 JSONPath for a validation issue path, e.g. `$.line_items[0].id`. */
function toJsonPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (jsonPath, segment) => typeof segment === 'number' ? `${jsonPath}[${segment}]` : `${jsonPath}.${String(segment)}`,
    '$',
  );
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

/** Handler configs MUST carry the merchant account and PSP (payment handlers RFC §10). */
function assertPaymentHandlers(options: ACPPaymentHandlerOption[]): void {
  const ids = new Set<string>();

  for (const { handler } of options) {
    if (ids.has(handler.id)) {
      throw new Error(`ACP payment handler ids must be unique: ${handler.id}`);
    }
    ids.add(handler.id);

    if (!handler.config.merchant_id || handler.config.psp !== handler.psp) {
      throw new Error(`ACP payment handler ${handler.id} must configure merchant_id and the handler's psp.`);
    }
  }
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
    return jsonResponse(error.body, { status: error.status, headers: error.headers });
  }

  console.error('ACP: request failed:', error);

  return acpErrorResponse(500, {
    type: 'processing_error',
    code: 'internal_error',
    message: 'An unexpected error occurred.',
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

/**
 * The value of a backend result. Failures are reported without backend
 * internals: invalid input or a missing resource the request referred to
 * (at `param`) is the agent's error; anything else is a server-side
 * processing error, logged for the operator.
 */
async function unwrapACPResult<T>(
  resultPromise: Promise<Result<T>>,
  param?: string,
): Promise<T> {
  const result = await resultPromise;

  if (result.success) {
    return result.value;
  }

  const errorType: unknown = typeof result.error === 'object' && result.error !== null
    ? Reflect.get(result.error, 'type')
    : undefined;

  if (param && (errorType === 'NotFound' || errorType === 'InvalidInput')) {
    throw new ACPHttpError(400, {
      type: 'invalid_request',
      code: errorType === 'NotFound' ? 'not_found' : 'invalid',
      message: errorType === 'NotFound'
        ? 'The referenced resource does not exist.'
        : 'The request was rejected by the commerce backend.',
      param,
    });
  }

  console.error('ACP: commerce backend operation failed:', result.error);

  throw new ACPHttpError(502, {
    type: 'processing_error',
    code: 'backend_error',
    message: 'The commerce backend could not process the request.',
  });
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

/**
 * A 2026-04-17 line item: quantity and a totals breakdown, plus display
 * fields from the product. Per-line tax is not known to the cart, so no tax
 * entry is reported per line.
 */
function toACPLineItem(
  item: Checkout['items'][number] | Cart['items'][number],
  product: Product | undefined,
): Record<string, unknown> {
  const sku = item.variant.sku;
  const variant = product
    ? [product.mainVariant, ...product.variants].find((candidate) => candidate.identifier.sku === sku)
    : undefined;
  const baseAmount = toMinorUnits({ value: item.price.unitPrice.value * item.quantity, currency: item.price.unitPrice.currency });
  const discount = Math.abs(toMinorUnits(item.price.totalDiscount));
  const images = (variant?.images ?? product?.mainVariant.images ?? [])
    .map((image) => image.sourceUrl)
    .filter((url) => url.length > 0);
  const name = variant?.name || product?.name;

  return {
    id: item.identifier.key,
    item: { id: sku },
    quantity: item.quantity,
    ...(name ? { name } : {}),
    ...(product?.description ? { description: product.description } : {}),
    ...(images.length > 0 ? { images } : {}),
    unit_amount: toMinorUnits(item.price.unitPrice),
    ...(product ? { product_id: product.identifier.key } : {}),
    sku,
    ...(variant && variant.options.length > 0
      ? { variant_options: variant.options.map((option) => ({ name: option.name, value: option.value.label })) }
      : {}),
    totals: [
      { type: 'items_base_amount', display_text: 'Base Amount', amount: baseAmount },
      ...(discount > 0 ? [{ type: 'discount', display_text: 'Discount', amount: discount }] : []),
      { type: 'subtotal', display_text: 'Subtotal', amount: Math.max(baseAmount - discount, 0) },
      { type: 'total', display_text: 'Total', amount: toMinorUnits(item.price.totalPrice) },
    ],
  };
}

function toACPTotals(price: Checkout['price']): Record<string, unknown>[] {
  const base = toMinorUnits(price.totalProductPrice);
  const discount = Math.abs(toMinorUnits(price.totalDiscount));
  const subtotal = Math.max(base - discount, 0);
  const fulfillment = toMinorUnits(price.totalShipping);
  const tax = toMinorUnits(price.totalTax);
  const total = toMinorUnits(price.grandTotal);

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

/**
 * A 2026-04-17 shipping option: its cost is a `totals[]` breakdown. The
 * description carries the backend's delivery estimate, falling back to the
 * method description. Backends report the estimate as free text, so no
 * delivery timestamps are claimed.
 */
function toACPFulfillmentOption(
  method: ShippingMethod,
  title: string,
): Record<string, unknown> {
  const description = method.deliveryTime || method.description;

  return {
    type: 'shipping',
    id: method.identifier.key,
    title,
    ...(description ? { description } : {}),
    ...(method.carrier ? { carrier: method.carrier } : {}),
    totals: [{ type: 'total', display_text: title, amount: toMinorUnits(method.price) }],
  };
}

/** Option titles by option key; sibling titles must be distinct for buyers to choose. */
function getOptionTitles(options: ShippingMethod[]): Map<string, string> {
  const titles = new Map<string, string>();
  const used = new Set<string>();

  for (const option of options) {
    let title = option.name || option.identifier.key;
    if (used.has(title)) {
      title = `${title} (${option.identifier.key})`;
    }
    used.add(title);
    titles.set(option.identifier.key, title);
  }

  return titles;
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

// ISO 4217 exponents that differ from the common 2 (as in the UCP adapter).
const CURRENCY_EXPONENTS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0,
  RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

/** An amount in the currency's minor units, e.g. cents; signs are kept. */
function toMinorUnits(amount: MonetaryAmount): number {
  const exponent = CURRENCY_EXPONENTS[amount.currency.toUpperCase()] ?? 2;

  return Math.round(amount.value * 10 ** exponent);
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
