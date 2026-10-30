import {
  createMcpHandler,
  fromJsonSchema,
  hostHeaderValidationResponse,
  McpServer,
  originValidationResponse,
  type CallToolResult,
  type CreateMcpHandlerOptions,
  type GetPromptResult,
  type McpHttpHandler,
  type ReadResourceResult,
} from '@modelcontextprotocol/server';
import {
  toNodeHandler,
  type NodeMcpRequestHandler,
} from '@modelcontextprotocol/node';
import {
  createInitialRequestContext,
  MemoryCache,
  SessionSchema,
  traceProtocolInvocation,
  type Cache,
  type RequestContext,
  type Result,
  type Session,
} from '@reactionary/core';
import * as z from 'zod';
import {
  discoverReactionaryMCPTools,
  type DiscoverReactionaryMCPToolsOptions,
  type ReactionaryMCPClient,
  type ReactionaryMCPTool,
} from './tool-discovery.js';
import { TOOL_DESCRIPTIONS } from './tool-descriptions.js';
import {
  REACTIONARY_SHOPPING_AGENT_GUIDE,
  REACTIONARY_SHOPPING_AGENT_GUIDE_PROMPT,
  REACTIONARY_SHOPPING_AGENT_GUIDE_URI,
} from './shopping-agent-guide.js';

export type ReactionaryMCPClientFactory = (
  requestContext: RequestContext,
) => ReactionaryMCPClient;

export interface ReactionaryMCPServerOptions
  extends DiscoverReactionaryMCPToolsOptions {
  name?: string;
  version?: string;
  sessionCache?: Cache;
  sessionTtlSeconds?: number;
  /**
   * Hostnames (no port, IPv6 in brackets) accepted in the `Host` header. Requests for any other host are answered with 403.
   * This is what stops DNS rebinding attacks against a locally reachable server. Not enforced unless set, so that hosts
   * behind a custom domain keep working; servers reachable from a browser on the same machine should set it, for example
   * to `localhostAllowedHostnames()` from `@modelcontextprotocol/server`.
   */
  allowedHostnames?: string[];
  /**
   * Hostnames (no scheme or port, IPv6 in brackets) accepted in the `Origin` header. Requests carrying any other origin are
   * answered with 403. Requests without an `Origin` header (non-browser clients) pass. Not enforced unless set.
   */
  allowedOriginHostnames?: string[];
  /**
   * Decides whether a request may use the server, typically by checking its `Authorization` header. Runs after the host and
   * origin checks and before any MCP handling. A request for which it returns false, or throws, is answered with 401.
   */
  authorize?: (request: Request) => boolean | Promise<boolean>;
  handler?: Pick<
    CreateMcpHandlerOptions,
    | 'bus'
    | 'keepAliveMs'
    | 'legacy'
    | 'maxRequestBodySize'
    | 'maxSubscriptions'
    | 'onerror'
    | 'responseMode'
  >;
}

export class ReactionaryMCPServer {
  private readonly handler: McpHttpHandler;
  private readonly sessionStore: ReactionaryMCPSessionStore;

  constructor(
    private readonly clientFactory: ReactionaryMCPClientFactory,
    private readonly options: ReactionaryMCPServerOptions = {},
  ) {
    this.sessionStore = new ReactionaryMCPSessionStore(
      this.options.sessionCache ?? new MemoryCache(),
      this.options.sessionTtlSeconds ?? 60 * 60 * 24,
    );
    this.handler = createMcpHandler(
      (ctx) => this.createServer(getMcpSessionId(ctx.requestInfo)),
      this.options.handler,
    );
  }

  public async fetch(
    request: Request,
    options?: Parameters<McpHttpHandler['fetch']>[1],
  ): Promise<Response> {
    const rejection = await this.rejectRequest(request);
    if (rejection) {
      return rejection;
    }

    const sessionId = getOrCreateMcpSessionId(request);
    const sessionRequest = withMcpSessionId(request, sessionId);

    const response = await this.handler.fetch(sessionRequest, options);
    response.headers.set(MCP_SESSION_ID_HEADER, sessionId);
    return response;
  }

  public getHandler(): McpHttpHandler {
    return {
      ...this.handler,
      fetch: (request, options) => this.fetch(request, options),
      close: () => this.close(),
    };
  }

  public toNodeHandler(): NodeMcpRequestHandler {
    return toNodeHandler(this.getHandler());
  }

  public close(): Promise<void> {
    return this.handler.close();
  }

  public discoverTools(): ReactionaryMCPTool[] {
    return this.discoverToolsForClient(
      this.clientFactory(createInitialRequestContext()),
    );
  }

  /**
   * Returns the response to answer with when the request must not reach the MCP handler, or undefined when it may proceed.
   * Override to change how requests are screened.
   */
  protected async rejectRequest(request: Request): Promise<Response | undefined> {
    const { allowedHostnames, allowedOriginHostnames } = this.options;

    const rejection =
      (allowedHostnames
        ? hostHeaderValidationResponse(request, allowedHostnames)
        : undefined) ??
      (allowedOriginHostnames
        ? originValidationResponse(request, allowedOriginHostnames)
        : undefined);

    if (rejection || !this.options.authorize) {
      return rejection;
    }

    return (await this.isAuthorized(this.options.authorize, request))
      ? undefined
      : unauthorizedResponse();
  }

  private async isAuthorized(
    authorize: NonNullable<ReactionaryMCPServerOptions['authorize']>,
    request: Request,
  ): Promise<boolean> {
    try {
      return await authorize(request);
    } catch (error) {
      this.options.handler?.onerror?.(
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  private async createServer(sessionId: string | undefined): Promise<McpServer> {
    const restoredSession = sessionId
      ? await this.sessionStore.get(sessionId)
      : undefined;
    const requestContext = createInitialRequestContext();

    if (restoredSession) {
      requestContext.session = restoredSession;
    }

    const client = this.clientFactory(requestContext);
    const server = new McpServer({
      name: this.options.name ?? '@reactionary/mcp',
      version: this.options.version ?? '0.0.1',
    });

    this.registerShoppingAgentGuide(server);

    for (const tool of this.discoverToolsForClient(client)) {
      this.registerTool(server, tool, sessionId, requestContext);
    }

    return server;
  }

  private discoverToolsForClient(
    client: ReactionaryMCPClient,
  ): ReactionaryMCPTool[] {
    return discoverReactionaryMCPTools(client, this.options);
  }

  private registerShoppingAgentGuide(server: McpServer): void {
    server.registerResource(
      'reactionary-shopping-agent-guide',
      REACTIONARY_SHOPPING_AGENT_GUIDE_URI,
      {
        title: 'Reactionary Shopping Agent Guide',
        description:
          'Operational guide for combining Reactionary MCP shopping tools safely.',
        mimeType: 'text/markdown',
      },
      (uri): ReadResourceResult => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: REACTIONARY_SHOPPING_AGENT_GUIDE,
          },
        ],
      }),
    );

    server.registerPrompt(
      REACTIONARY_SHOPPING_AGENT_GUIDE_PROMPT,
      {
        title: 'Reactionary Shopping Agent Guide',
        description:
          'Use this prompt to learn the recommended search, product, cart, checkout, and guardrail flow for Reactionary MCP tools.',
      },
      (): GetPromptResult => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: REACTIONARY_SHOPPING_AGENT_GUIDE,
            },
          },
        ],
      }),
    );
  }

  private registerTool(
    server: McpServer,
    tool: ReactionaryMCPTool,
    sessionId: string | undefined,
    requestContext: RequestContext,
  ): void {
    const inputSchema = toMcpInputSchema(tool);

    server.registerTool(
      tool.name,
      {
        title: tool.entrypoint.title,
        description: describeTool(tool),
        inputSchema,
        outputSchema: toMcpOutputSchema(tool.entrypoint.outputSchema),
      },
      async (args: unknown): Promise<CallToolResult> =>
        traceProtocolInvocation(
          {
            protocol: 'mcp',
            operation: `tools/${tool.name}`,
            attributes: {
              'labels.capability': tool.entrypoint.capabilityName,
              'labels.method': tool.entrypoint.methodName,
            },
          },
          async () => {
            const result = await callReactionaryTool(
              tool,
              inputSchema ? args : undefined,
            );

            if (sessionId) {
              await this.sessionStore.put(sessionId, requestContext.session);
            }

            return resultToCallToolResult(result);
          },
          (callToolResult) => ({
            'labels.status': callToolResult.isError ? 'error' : 'success',
          }),
        ),
    );
  }
}

const MCP_SESSION_ID_HEADER = 'mcp-session-id';
const SESSION_CACHE_KEY_PREFIX = 'reactionary:mcp:session';

class ReactionaryMCPSessionStore {
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

function unauthorizedResponse(): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized' },
      id: null,
    },
    { status: 401, headers: { 'www-authenticate': 'Bearer' } },
  );
}

function getMcpSessionId(request: Request | undefined): string | undefined {
  return request?.headers.get(MCP_SESSION_ID_HEADER) ?? undefined;
}

function getOrCreateMcpSessionId(request: Request): string {
  return getMcpSessionId(request) ?? crypto.randomUUID();
}

function withMcpSessionId(request: Request, sessionId: string): Request {
  if (getMcpSessionId(request) === sessionId) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set(MCP_SESSION_ID_HEADER, sessionId);

  return new Request(request, { headers });
}

/**
 * What an agent is told about a tool: the description set on the method, otherwise the one of the operation in
 * TOOL_DESCRIPTIONS. The tool name is left out of the lookup because it can be customized, the operation cannot.
 */
function describeTool(tool: ReactionaryMCPTool): string | undefined {
  const { capabilityName, methodName, description } = tool.entrypoint;
  return description ?? TOOL_DESCRIPTIONS[`${capabilityName}.${methodName}`];
}

/** An object with any properties, for a tool whose method declares no input schema. A constant so that its conversion is cached. */
const anyPropertiesSchema = z.looseObject({});

/** The tools that were published without a declared input schema, so that the warning is given once per tool. */
const toolsWithoutInputSchema = new Set<string>();

/**
 * The input schema of a tool, or undefined when the tool takes no input.
 *
 * A method that declares no input schema gets the default one, which accepts anything, and there is no way to tell
 * whether it takes a payload. Dropping the arguments of such a tool would make the method fail on a missing payload
 * with nothing in the tool to say so, so it is published as an object with any properties and the arguments are
 * passed on. Declare the input schema on the method to have its fields described.
 */
function toMcpInputSchema(tool: ReactionaryMCPTool): McpSchema | undefined {
  const schema = tool.entrypoint.inputSchema;
  const type = getZodDef(schema).type;

  if (type === 'undefined' || type === 'void' || type === 'never') {
    return undefined;
  }

  if (type === 'unknown' || type === 'any') {
    if (!toolsWithoutInputSchema.has(tool.name)) {
      toolsWithoutInputSchema.add(tool.name);
      console.warn(
        `@reactionary/mcp: ${tool.name} declares no input schema, so agents are not told what it takes. Declare inputSchema on the method.`,
      );
    }
    return toMcpSchema(anyPropertiesSchema);
  }

  return toMcpSchema(schema);
}

type McpSchema = ReturnType<typeof convertToMcpSchema>;

/**
 * A server is built per request and registers every tool, and the schemas are module level constants, so the
 * (expensive) conversion is cached per schema instance instead of repeated on every request.
 */
const inputSchemaCache = new WeakMap<z.ZodType, McpSchema>();
const outputSchemaCache = new WeakMap<z.ZodType, McpSchema>();

function toMcpSchema(schema: z.ZodType): McpSchema {
  const cached = inputSchemaCache.get(schema);
  if (cached) {
    return cached;
  }

  const converted = convertToMcpSchema(schema);
  inputSchemaCache.set(schema, converted);
  return converted;
}

function toMcpOutputSchema(schema: z.ZodType): McpSchema {
  const cached = outputSchemaCache.get(schema);
  if (cached) {
    return cached;
  }

  const converted = convertToMcpSchema(z.object({
    value: normalizeOutputValueSchema(schema),
  }));
  outputSchemaCache.set(schema, converted);
  return converted;
}

function convertToMcpSchema(schema: z.ZodType) {
  return fromJsonSchema(
    z.toJSONSchema(prepareForJsonSchema(schema), {
      io: 'input',
    }) as Record<string, unknown>,
  );
}

function normalizeOutputValueSchema(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodVoid || schema instanceof z.ZodUndefined) {
    return z.null();
  }

  return schema.nullable();
}

/**
 * Schemas being prepared right now. A schema that refers back to itself (such as an origin that nests its upstream origin)
 * would otherwise recurse forever, so the inner reference is left unconstrained in the tool schema.
 */
const schemasInPreparation = new Set<z.ZodType>();

function prepareForJsonSchema(schema: z.ZodType): z.ZodType {
  if (schemasInPreparation.has(schema)) {
    return z.unknown();
  }

  schemasInPreparation.add(schema);
  try {
    return prepareSchemaForJsonSchema(schema);
  } finally {
    schemasInPreparation.delete(schema);
  }
}

function prepareSchemaForJsonSchema(schema: z.ZodType): z.ZodType {
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

  // A default that throws when it is evaluated fails every call that leaves the field out, so the field is required.
  // Publishing it as optional would invite exactly that call.
  if (!defaultValue.success) {
    return copyMetadata(schema, preparedInnerType);
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

async function callReactionaryTool(
  tool: ReactionaryMCPTool,
  input: unknown,
): Promise<Result<unknown>> {
  const method: unknown = Reflect.get(
    tool.capability,
    tool.entrypoint.methodName,
  );

  if (typeof method !== 'function') {
    throw new Error(`Reactionary MCP tool method not found: ${tool.name}`);
  }

  const result: unknown = await Reflect.apply(method, tool.capability, [input]);

  if (!isReactionaryResult(result)) {
    throw new Error(
      `Reactionary MCP tool method did not return a Result: ${tool.name}`,
    );
  }

  return result;
}

function isReactionaryResult(value: unknown): value is Result<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
}

function resultToCallToolResult(result: Result<unknown>): CallToolResult {
  if (!result.success) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.error),
        },
      ],
    };
  }

  return {
    structuredContent: toMcpStructuredContent(result.value),
    content: [
      {
        type: 'text',
        text: JSON.stringify(toMcpStructuredContent(result.value)),
      },
    ],
  };
}

function toMcpStructuredContent(value: unknown): Record<string, unknown> {
  return {
    value: value ?? null,
  };
}
