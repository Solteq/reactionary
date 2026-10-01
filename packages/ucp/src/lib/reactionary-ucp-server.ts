import {
  BaseCapability,
  createInitialRequestContext,
  getReactionaryEntrypoints,
  MemoryCache,
  SessionSchema,
  type Cache,
  type ReactionaryEntrypointMetadata,
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

export type ReactionaryUCPClient = object;

export type ReactionaryUCPClientFactory<TClient extends ReactionaryUCPClient = ReactionaryUCPClient> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryUCPAction {
  name: string;
  title: string;
  description: string;
  capability: string;
  method: string;
  inputSchema?: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  mutates: boolean;
  idempotent: boolean;
  requiresAuth: boolean;
  riskLevel: 'low' | 'medium' | 'high';
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

      const result = await invokeUCPAction(action, parseResult.value.payload ?? {});
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

interface UCPDiscoveredAction {
  definition: ReactionaryUCPAction;
  capability: BaseCapability;
  entrypoint: ReactionaryEntrypointMetadata;
}

interface UCPActionMetadataOverride {
  name?: string;
  title?: string;
  description?: string;
  mutates?: boolean;
  idempotent?: boolean;
  requiresAuth?: boolean;
  riskLevel?: ReactionaryUCPAction['riskLevel'];
}

const UCP_ACTION_OVERRIDES: Record<string, UCPActionMetadataOverride> = {
  'product-search.queryByTerm': {
    name: 'product.search',
    title: 'Search products',
    description: 'Search the product catalog by term, facets, filters, and pagination options.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'product.getById': {
    name: 'product.get_by_id',
    title: 'Get product by id',
    description: 'Fetch full product details by product identifier.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'product.getBySlug': {
    name: 'product.get_by_slug',
    title: 'Get product by slug',
    description: 'Fetch full product details by storefront slug.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'product.getBySKU': {
    name: 'product.get_by_sku',
    title: 'Get product by SKU',
    description: 'Fetch full product details using a variant SKU.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'cart.getById': {
    name: 'cart.get',
    title: 'Get cart',
    description: 'Fetch a cart by identifier.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'cart.getActiveCartId': {
    name: 'cart.get_active_id',
    title: 'Get active cart id',
    description: 'Fetch the active cart identifier for the current session.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'cart.listCarts': {
    name: 'cart.list',
    title: 'List carts',
    description: 'List carts available to the current session or identity.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'cart.createCart': {
    name: 'cart.create',
    title: 'Create cart',
    description: 'Create a cart for the current session or identity.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'cart.add': {
    name: 'cart.add_item',
    title: 'Add item to cart',
    description: 'Add a product variant to a cart, creating a cart if required by the provider.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'cart.remove': {
    name: 'cart.remove_item',
    title: 'Remove item from cart',
    description: 'Remove an item from a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'cart.changeQuantity': {
    name: 'cart.change_quantity',
    title: 'Change cart item quantity',
    description: 'Change the quantity of an item in a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'cart.deleteCart': {
    name: 'cart.delete',
    title: 'Delete cart',
    description: 'Delete a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'high',
  },
  'cart.renameCart': {
    name: 'cart.rename',
    title: 'Rename cart',
    description: 'Rename a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'cart.applyCouponCode': {
    name: 'cart.apply_coupon',
    title: 'Apply coupon',
    description: 'Apply a coupon code to a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'cart.removeCouponCode': {
    name: 'cart.remove_coupon',
    title: 'Remove coupon',
    description: 'Remove a coupon code from a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'cart.changeCurrency': {
    name: 'cart.change_currency',
    title: 'Change cart currency',
    description: 'Change the currency of a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'checkout.initiateCheckoutForCart': {
    name: 'checkout.initiate',
    title: 'Initiate checkout',
    description: 'Create a checkout snapshot from a cart.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'checkout.getById': {
    name: 'checkout.get',
    title: 'Get checkout',
    description: 'Fetch a checkout by identifier.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'checkout.setShippingAddress': {
    name: 'checkout.set_shipping_address',
    title: 'Set checkout shipping address',
    description: 'Set or update the shipping address for a checkout.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'checkout.getAvailableShippingMethods': {
    name: 'checkout.list_shipping_methods',
    title: 'List checkout shipping methods',
    description: 'List shipping methods available for a checkout.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'checkout.getAvailablePaymentMethods': {
    name: 'checkout.list_payment_methods',
    title: 'List checkout payment methods',
    description: 'List payment methods available for a checkout.',
    mutates: false,
    idempotent: true,
    requiresAuth: false,
    riskLevel: 'low',
  },
  'checkout.addPaymentInstruction': {
    name: 'checkout.add_payment_instruction',
    title: 'Add checkout payment instruction',
    description: 'Add a delegated payment instruction to a checkout.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'high',
  },
  'checkout.removePaymentInstruction': {
    name: 'checkout.remove_payment_instruction',
    title: 'Remove checkout payment instruction',
    description: 'Remove a payment instruction from a checkout.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'checkout.setShippingInstruction': {
    name: 'checkout.set_shipping_instruction',
    title: 'Set checkout shipping instruction',
    description: 'Set the selected shipping method and pickup information for a checkout.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'medium',
  },
  'checkout.finalizeCheckout': {
    name: 'checkout.finalize',
    title: 'Finalize checkout',
    description: 'Finalize a checkout and submit the order.',
    mutates: true,
    idempotent: false,
    requiresAuth: false,
    riskLevel: 'high',
  },
};

function getAvailableActions<TClient extends ReactionaryUCPClient>(
  client: TClient,
): ReactionaryUCPAction[] {
  return discoverUCPActions(client).map((action) => action.definition);
}

function getAvailableActionDefinition<TClient extends ReactionaryUCPClient>(
  client: TClient,
  actionName: string,
): UCPDiscoveredAction | undefined {
  return discoverUCPActions(client).find(
    (action) => action.definition.name === actionName,
  );
}

function discoverUCPActions(
  client: ReactionaryUCPClient,
): UCPDiscoveredAction[] {
  return Object.values(client).flatMap((value) => {
    if (!(value instanceof BaseCapability)) {
      return [];
    }

    return getReactionaryEntrypoints(value).map((entrypoint) => {
      const definition = createUCPActionDefinition(entrypoint);
      return {
        definition,
        capability: value,
        entrypoint,
      };
    });
  });
}

function createUCPActionDefinition(
  entrypoint: ReactionaryEntrypointMetadata,
): ReactionaryUCPAction {
  const override = getActionMetadataOverride(entrypoint);
  return {
    name: override.name ?? `${entrypoint.capabilityName}.${entrypoint.methodName}`,
    title: override.title ?? entrypoint.title ?? `${entrypoint.capabilityName}.${entrypoint.methodName}`,
    description: override.description ?? entrypoint.description ?? '',
    capability: entrypoint.capabilityName,
    method: entrypoint.methodName,
    inputSchema: acceptsUndefined(entrypoint.inputSchema)
      ? undefined
      : toUcpJsonSchema(entrypoint.inputSchema, 'input'),
    outputSchema: toUcpJsonSchema(entrypoint.outputSchema, 'output'),
    mutates: override.mutates ?? !entrypoint.cache,
    idempotent: override.idempotent ?? entrypoint.cache,
    requiresAuth: override.requiresAuth ?? false,
    riskLevel: override.riskLevel ?? (entrypoint.cache ? 'low' : 'medium'),
  };
}

function getActionMetadataOverride(
  entrypoint: ReactionaryEntrypointMetadata,
): UCPActionMetadataOverride {
  return UCP_ACTION_OVERRIDES[
    `${entrypoint.capabilityName}.${entrypoint.methodName}`
  ] ?? {};
}

async function invokeUCPAction(
  action: UCPDiscoveredAction,
  payload: unknown,
): Promise<UCPResult> {
  const method: unknown = Reflect.get(
    action.capability,
    action.entrypoint.methodName,
  );

  if (typeof method !== 'function') {
    throw new Error(`UCP action target is unavailable: ${action.definition.name}`);
  }

  const input = acceptsUndefined(action.entrypoint.inputSchema)
    ? undefined
    : payload;
  const result: unknown = await Reflect.apply(method, action.capability, [input]);

  if (!isReactionaryResult(result)) {
    throw new Error(
      `UCP action target did not return a Reactionary Result: ${action.definition.name}`,
    );
  }

  return result;
}

function isReactionaryResult(value: unknown): value is UCPResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
}

function acceptsUndefined(schema: z.ZodType): boolean {
  return schema.safeParse(undefined).success;
}

function toUcpJsonSchema(
  schema: z.ZodType,
  io: 'input' | 'output',
): Record<string, unknown> {
  return z.toJSONSchema(prepareForJsonSchema(schema), { io }) as Record<string, unknown>;
}

function prepareForJsonSchema(schema: z.ZodType): z.ZodType {
  const def = getZodDef(schema);

  switch (def.type) {
    case 'default':
      return applySafeDefault(schema, prepareForJsonSchema(def.innerType));
    case 'object':
      return copyMetadata(schema, z.looseObject(prepareShapeForJsonSchema(def.shape)));
    case 'array':
      return copyMetadata(schema, z.array(prepareForJsonSchema(def.element)));
    case 'optional':
      return copyMetadata(schema, prepareForJsonSchema(def.innerType).optional());
    case 'nullable':
      return copyMetadata(schema, prepareForJsonSchema(def.innerType).nullable());
    case 'union':
      return copyMetadata(schema, prepareUnionForJsonSchema(def.options));
    default:
      return schema;
  }
}

function applySafeDefault(
  schema: z.ZodType,
  preparedInnerType: z.ZodType,
): z.ZodType {
  const defaultValue = getSafeDefaultValue(schema);

  if (!defaultValue.success) {
    return copyMetadata(schema, preparedInnerType.optional());
  }

  return copyMetadata(
    schema,
    preparedInnerType.default(defaultValue.value),
  );
}

type SafeDefaultValue =
  | { success: true; value: unknown }
  | { success: false };

function getSafeDefaultValue(schema: z.ZodType): SafeDefaultValue {
  try {
    return {
      success: true,
      value: getZodDef(schema).defaultValue,
    };
  } catch {
    return { success: false };
  }
}

function copyMetadata(
  source: z.ZodType,
  target: z.ZodType,
): z.ZodType {
  const metadata = source.meta();
  return metadata ? target.meta(metadata) : target;
}

interface ZodDef {
  type: string;
  innerType: z.ZodType;
  shape: Record<string, z.ZodType>;
  element: z.ZodType;
  options: z.ZodType[];
  defaultValue: unknown;
}

function getZodDef(schema: z.ZodType): ZodDef {
  return (schema as z.ZodType & { _zod: { def: ZodDef } })._zod.def;
}

function prepareShapeForJsonSchema(
  shape: Record<string, z.ZodType>,
): Record<string, z.ZodType> {
  return Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [
      key,
      prepareForJsonSchema(value),
    ]),
  );
}

function prepareUnionForJsonSchema(options: z.ZodType[]): z.ZodType {
  const preparedOptions = options.map(prepareForJsonSchema);

  if (preparedOptions.length < 2) {
    return preparedOptions[0] ?? z.unknown();
  }

  return z.union(
    preparedOptions as [z.ZodType, z.ZodType, ...z.ZodType[]],
  );
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
