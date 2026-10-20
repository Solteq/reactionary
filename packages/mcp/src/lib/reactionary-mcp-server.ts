import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
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

  public fetch(
    request: Request,
    options?: Parameters<McpHttpHandler['fetch']>[1],
  ): Promise<Response> {
    const sessionId = getOrCreateMcpSessionId(request);
    const sessionRequest = withMcpSessionId(request, sessionId);

    return this.handler.fetch(sessionRequest, options).then((response) => {
      response.headers.set(MCP_SESSION_ID_HEADER, sessionId);
      return response;
    });
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
    const inputSchema = acceptsUndefined(tool.entrypoint.inputSchema)
      ? undefined
      : toMcpSchema(tool.entrypoint.inputSchema);

    server.registerTool(
      tool.name,
      {
        title: tool.entrypoint.title,
        description: tool.entrypoint.description,
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

function acceptsUndefined(schema: z.ZodType): boolean {
  return schema.safeParse(undefined).success;
}

function toMcpSchema(schema: z.ZodType) {
  return fromJsonSchema(
    z.toJSONSchema(prepareForJsonSchema(schema), {
      io: 'input',
    }) as Record<string, unknown>,
  );
}

function toMcpOutputSchema(schema: z.ZodType) {
  return toMcpSchema(z.object({
    value: normalizeOutputValueSchema(schema),
  }));
}

function normalizeOutputValueSchema(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodVoid || schema instanceof z.ZodUndefined) {
    return z.null();
  }

  return schema.nullable();
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
