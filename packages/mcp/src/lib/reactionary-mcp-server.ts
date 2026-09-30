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
import type { Result } from '@reactionary/core';
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

export interface ReactionaryMCPServerOptions
  extends DiscoverReactionaryMCPToolsOptions {
  name?: string;
  version?: string;
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

  constructor(
    private readonly client: ReactionaryMCPClient,
    private readonly options: ReactionaryMCPServerOptions = {},
  ) {
    this.handler = createMcpHandler(
      () => this.createServer(),
      this.options.handler,
    );
  }

  public fetch(
    request: Request,
    options?: Parameters<McpHttpHandler['fetch']>[1],
  ): Promise<Response> {
    return this.handler.fetch(request, options);
  }

  public getHandler(): McpHttpHandler {
    return this.handler;
  }

  public toNodeHandler(): NodeMcpRequestHandler {
    return toNodeHandler(this.handler);
  }

  public close(): Promise<void> {
    return this.handler.close();
  }

  public discoverTools(): ReactionaryMCPTool[] {
    return discoverReactionaryMCPTools(this.client, this.options);
  }

  private createServer(): McpServer {
    const server = new McpServer({
      name: this.options.name ?? '@reactionary/mcp',
      version: this.options.version ?? '0.0.1',
    });

    this.registerShoppingAgentGuide(server);

    for (const tool of this.discoverTools()) {
      this.registerTool(server, tool);
    }

    return server;
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

  private registerTool(server: McpServer, tool: ReactionaryMCPTool): void {
    const inputSchema = acceptsUndefined(tool.entrypoint.inputSchema)
      ? undefined
      : toMcpSchema(tool.entrypoint.inputSchema);

    server.registerTool(
      tool.name,
      {
        title: tool.entrypoint.title,
        description: tool.entrypoint.description,
        inputSchema,
        outputSchema: toMcpSchema(tool.entrypoint.outputSchema),
      },
      async (args: unknown): Promise<CallToolResult> => {
        const result = await callReactionaryTool(
          tool,
          inputSchema ? args : undefined,
        );
        return resultToCallToolResult(result);
      },
    );
  }
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
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.value),
      },
    ],
    structuredContent: result.value,
  };
}
