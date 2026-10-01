import {
  createInitialRequestContext,
  MemoryCache,
  SessionSchema,
  type Cache,
  type RequestContext,
  type Result,
  type Session,
} from '@reactionary/core';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import * as z from 'zod';

const UCP_SESSION_ID_HEADER = 'ucp-session-id';
const SESSION_CACHE_KEY_PREFIX = 'reactionary:ucp:session';
type ProtocolHeaders = Headers | Record<string, string>;
const UCPActionRequestSchema = z.object({
  action: z.string().min(1),
  payload: z.unknown().optional(),
});

type UCPActionRequest = z.infer<typeof UCPActionRequestSchema>;

type UCPResult = Result<unknown, unknown>;
type UCPActionInvoker<TClient> = (
  client: TClient,
  payload: unknown,
) => Promise<UCPResult>;

export interface ReactionaryUCPClient {
  productSearch?: {
    queryByTerm?(payload: unknown): Promise<UCPResult>;
  };
  product?: {
    getById?(payload: unknown): Promise<UCPResult>;
    getBySlug?(payload: unknown): Promise<UCPResult>;
    getBySKU?(payload: unknown): Promise<UCPResult>;
  };
  cart?: {
    getById?(payload: unknown): Promise<UCPResult>;
    getActiveCartId?(payload: unknown): Promise<UCPResult>;
    add?(payload: unknown): Promise<UCPResult>;
    remove?(payload: unknown): Promise<UCPResult>;
    changeQuantity?(payload: unknown): Promise<UCPResult>;
    listCarts?(payload: unknown): Promise<UCPResult>;
    createCart?(payload: unknown): Promise<UCPResult>;
    deleteCart?(payload: unknown): Promise<UCPResult>;
    renameCart?(payload: unknown): Promise<UCPResult>;
    applyCouponCode?(payload: unknown): Promise<UCPResult>;
    removeCouponCode?(payload: unknown): Promise<UCPResult>;
    changeCurrency?(payload: unknown): Promise<UCPResult>;
  };
  checkout?: {
    initiateCheckoutForCart?(payload: unknown): Promise<UCPResult>;
    getById?(payload: unknown): Promise<UCPResult>;
    setShippingAddress?(payload: unknown): Promise<UCPResult>;
    getAvailableShippingMethods?(payload: unknown): Promise<UCPResult>;
    getAvailablePaymentMethods?(payload: unknown): Promise<UCPResult>;
    addPaymentInstruction?(payload: unknown): Promise<UCPResult>;
    removePaymentInstruction?(payload: unknown): Promise<UCPResult>;
    setShippingInstruction?(payload: unknown): Promise<UCPResult>;
    finalizeCheckout?(payload: unknown): Promise<UCPResult>;
  };
}

export type ReactionaryUCPClientFactory<TClient extends ReactionaryUCPClient = ReactionaryUCPClient> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryUCPAction {
  name: string;
  title: string;
  description: string;
  capability: keyof ReactionaryUCPClient;
  method: string;
}

export interface ReactionaryUCPServerOptions {
  name?: string;
  version?: string;
  sessionCache?: Cache;
  sessionTtlSeconds?: number;
}

export interface ReactionaryUCPHttpHandler {
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export type ReactionaryUCPNodeRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

export class ReactionaryUCPServer<TClient extends ReactionaryUCPClient = ReactionaryUCPClient> {
  private readonly sessionStore: ReactionaryUCPSessionStore;

  public constructor(
    private readonly clientFactory: ReactionaryUCPClientFactory<TClient>,
    private readonly options: ReactionaryUCPServerOptions = {},
  ) {
    this.sessionStore = new ReactionaryUCPSessionStore(
      this.options.sessionCache ?? new MemoryCache(),
      this.options.sessionTtlSeconds ?? 60 * 60 * 24,
    );
  }

  public async fetch(request: Request): Promise<Response> {
    const sessionId = getOrCreateSessionId(request);
    const requestContext = await this.createRequestContext(sessionId);
    const client = this.clientFactory(requestContext);

    const response = await this.handleRequest(request, client);
    await this.sessionStore.put(sessionId, requestContext.session);
    response.headers.set(UCP_SESSION_ID_HEADER, sessionId);

    return response;
  }

  public getHandler(): ReactionaryUCPHttpHandler {
    return {
      fetch: (request) => this.fetch(request),
      close: () => this.close(),
    };
  }

  public toNodeHandler(): ReactionaryUCPNodeRequestHandler {
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
    client: TClient,
  ): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          allow: 'GET, HEAD, OPTIONS, POST',
        },
      });
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const actions = getAvailableActions(client);

      return jsonResponse({
        name: this.options.name ?? '@reactionary/ucp',
        version: this.options.version ?? '0.0.1',
        protocol: 'ucp',
        status: 'ready',
        actions,
      }, { omitBody: request.method === 'HEAD' });
    }

    if (request.method === 'POST') {
      const parseResult = await parseActionRequest(request);
      if (!parseResult.success) {
        return jsonResponse({
          error: parseResult.error,
        }, { status: 400 });
      }

      const action = getAvailableActionDefinition(client, parseResult.value.action);
      if (!action) {
        return jsonResponse({
          error: {
            code: 'UCP_ACTION_NOT_AVAILABLE',
            message: `UCP action is not available: ${parseResult.value.action}`,
          },
        }, { status: 404 });
      }

      const result = await action.invoke(client, parseResult.value.payload ?? {});
      return jsonResponse({
        action: action.definition.name,
        ...result,
      });
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
}

interface UCPActionDefinition<TClient extends ReactionaryUCPClient> {
  definition: ReactionaryUCPAction;
  invoke: UCPActionInvoker<TClient>;
}

const UCP_ACTION_DEFINITIONS: ReadonlyArray<UCPActionDefinition<ReactionaryUCPClient>> = [
  createActionDefinition({
    name: 'product.search',
    title: 'Search products',
    description: 'Search the product catalog by term, facets, filters, and pagination options.',
    capability: 'productSearch',
    method: 'queryByTerm',
  }),
  createActionDefinition({
    name: 'product.get_by_id',
    title: 'Get product by id',
    description: 'Fetch full product details by product identifier.',
    capability: 'product',
    method: 'getById',
  }),
  createActionDefinition({
    name: 'product.get_by_slug',
    title: 'Get product by slug',
    description: 'Fetch full product details by storefront slug.',
    capability: 'product',
    method: 'getBySlug',
  }),
  createActionDefinition({
    name: 'product.get_by_sku',
    title: 'Get product by SKU',
    description: 'Fetch full product details using a variant SKU.',
    capability: 'product',
    method: 'getBySKU',
  }),
  createActionDefinition({
    name: 'cart.get',
    title: 'Get cart',
    description: 'Fetch a cart by identifier.',
    capability: 'cart',
    method: 'getById',
  }),
  createActionDefinition({
    name: 'cart.get_active_id',
    title: 'Get active cart id',
    description: 'Fetch the active cart identifier for the current session.',
    capability: 'cart',
    method: 'getActiveCartId',
  }),
  createActionDefinition({
    name: 'cart.list',
    title: 'List carts',
    description: 'List carts available to the current session or identity.',
    capability: 'cart',
    method: 'listCarts',
  }),
  createActionDefinition({
    name: 'cart.create',
    title: 'Create cart',
    description: 'Create a cart for the current session or identity.',
    capability: 'cart',
    method: 'createCart',
  }),
  createActionDefinition({
    name: 'cart.add_item',
    title: 'Add item to cart',
    description: 'Add a product variant to a cart, creating a cart if required by the provider.',
    capability: 'cart',
    method: 'add',
  }),
  createActionDefinition({
    name: 'cart.remove_item',
    title: 'Remove item from cart',
    description: 'Remove an item from a cart.',
    capability: 'cart',
    method: 'remove',
  }),
  createActionDefinition({
    name: 'cart.change_quantity',
    title: 'Change cart item quantity',
    description: 'Change the quantity of an item in a cart.',
    capability: 'cart',
    method: 'changeQuantity',
  }),
  createActionDefinition({
    name: 'cart.delete',
    title: 'Delete cart',
    description: 'Delete a cart.',
    capability: 'cart',
    method: 'deleteCart',
  }),
  createActionDefinition({
    name: 'cart.rename',
    title: 'Rename cart',
    description: 'Rename a cart.',
    capability: 'cart',
    method: 'renameCart',
  }),
  createActionDefinition({
    name: 'cart.apply_coupon',
    title: 'Apply coupon',
    description: 'Apply a coupon code to a cart.',
    capability: 'cart',
    method: 'applyCouponCode',
  }),
  createActionDefinition({
    name: 'cart.remove_coupon',
    title: 'Remove coupon',
    description: 'Remove a coupon code from a cart.',
    capability: 'cart',
    method: 'removeCouponCode',
  }),
  createActionDefinition({
    name: 'cart.change_currency',
    title: 'Change cart currency',
    description: 'Change the currency of a cart.',
    capability: 'cart',
    method: 'changeCurrency',
  }),
  createActionDefinition({
    name: 'checkout.initiate',
    title: 'Initiate checkout',
    description: 'Create a checkout snapshot from a cart.',
    capability: 'checkout',
    method: 'initiateCheckoutForCart',
  }),
  createActionDefinition({
    name: 'checkout.get',
    title: 'Get checkout',
    description: 'Fetch a checkout by identifier.',
    capability: 'checkout',
    method: 'getById',
  }),
  createActionDefinition({
    name: 'checkout.set_shipping_address',
    title: 'Set checkout shipping address',
    description: 'Set or update the shipping address for a checkout.',
    capability: 'checkout',
    method: 'setShippingAddress',
  }),
  createActionDefinition({
    name: 'checkout.list_shipping_methods',
    title: 'List checkout shipping methods',
    description: 'List shipping methods available for a checkout.',
    capability: 'checkout',
    method: 'getAvailableShippingMethods',
  }),
  createActionDefinition({
    name: 'checkout.list_payment_methods',
    title: 'List checkout payment methods',
    description: 'List payment methods available for a checkout.',
    capability: 'checkout',
    method: 'getAvailablePaymentMethods',
  }),
  createActionDefinition({
    name: 'checkout.add_payment_instruction',
    title: 'Add checkout payment instruction',
    description: 'Add a payment instruction to a checkout.',
    capability: 'checkout',
    method: 'addPaymentInstruction',
  }),
  createActionDefinition({
    name: 'checkout.remove_payment_instruction',
    title: 'Remove checkout payment instruction',
    description: 'Remove a payment instruction from a checkout.',
    capability: 'checkout',
    method: 'removePaymentInstruction',
  }),
  createActionDefinition({
    name: 'checkout.set_shipping_instruction',
    title: 'Set checkout shipping instruction',
    description: 'Set the selected shipping method and pickup information for a checkout.',
    capability: 'checkout',
    method: 'setShippingInstruction',
  }),
  createActionDefinition({
    name: 'checkout.finalize',
    title: 'Finalize checkout',
    description: 'Finalize a checkout and submit the order.',
    capability: 'checkout',
    method: 'finalizeCheckout',
  }),
];

function createActionDefinition(
  definition: ReactionaryUCPAction,
): UCPActionDefinition<ReactionaryUCPClient> {
  return {
    definition,
    invoke: (client, payload) =>
      invokeCapabilityAction(client, definition.capability, definition.method, payload),
  };
}

function getAvailableActions<TClient extends ReactionaryUCPClient>(
  client: TClient,
): ReactionaryUCPAction[] {
  return UCP_ACTION_DEFINITIONS
    .filter((action) => isActionAvailable(client, action.definition))
    .map((action) => action.definition);
}

function getAvailableActionDefinition<TClient extends ReactionaryUCPClient>(
  client: TClient,
  actionName: string,
): UCPActionDefinition<TClient> | undefined {
  const action = UCP_ACTION_DEFINITIONS.find(
    (definition) => definition.definition.name === actionName &&
      isActionAvailable(client, definition.definition),
  );

  return action as UCPActionDefinition<TClient> | undefined;
}

function isActionAvailable<TClient extends ReactionaryUCPClient>(
  client: TClient,
  action: ReactionaryUCPAction,
): boolean {
  return getCapabilityMethod(client[action.capability], action.method) !== undefined;
}

async function invokeCapabilityAction(
  client: ReactionaryUCPClient,
  capabilityName: keyof ReactionaryUCPClient,
  methodName: string,
  payload: unknown,
): Promise<UCPResult> {
  const capability = client[capabilityName];
  const method = getCapabilityMethod(capability, methodName);
  if (!method) {
    throw new Error(`UCP action target is unavailable: ${String(capabilityName)}.${methodName}`);
  }

  return method(payload);
}

function getCapabilityMethod(
  capability: unknown,
  methodName: string,
): ((payload: unknown) => Promise<UCPResult>) | undefined {
  if (typeof capability !== 'object' || capability === null) {
    return undefined;
  }

  const methods = capability as Record<string, unknown>;
  const method = methods[methodName];
  if (typeof method !== 'function') {
    return undefined;
  }

  return method as (payload: unknown) => Promise<UCPResult>;
}

async function parseActionRequest(
  request: Request,
): Promise<
  | { success: true; value: UCPActionRequest }
  | { success: false; error: { code: string; message: string } }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      };
    }

    throw error;
  }

  const parseResult = UCPActionRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      success: false,
      error: {
        code: 'INVALID_UCP_ACTION_REQUEST',
        message: z.prettifyError(parseResult.error),
      },
    };
  }

  return {
    success: true,
    value: parseResult.data,
  };
}

class ReactionaryUCPSessionStore {
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

function getSessionId(request: Request): string | undefined {
  return request.headers.get(UCP_SESSION_ID_HEADER) ?? undefined;
}

function getOrCreateSessionId(request: Request): string {
  return getSessionId(request) ?? crypto.randomUUID();
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
