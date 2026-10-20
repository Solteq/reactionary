import * as z from 'zod';
import {
  ACPCancelCheckoutSessionRequestSchema,
  ACPCompleteCheckoutSessionRequestSchema,
  ACPCreateCheckoutSessionRequestSchema,
  ACPUpdateCheckoutSessionRequestSchema,
} from './acp-schemas.js';

/** The MCP protocol revision of the Streamable HTTP transport used. */
const MCP_PROTOCOL_VERSION = '2025-11-25';
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_PARSE_ERROR = -32700;
/** All ACP errors use -32000, with the ACP Error in `data` (MCP binding). */
const JSON_RPC_ACP_ERROR = -32000;

/** Protocol metadata, mapped to the REST headers. Unknown fields are ignored. */
const ACPMcpMetaSchema = z.looseObject({
  api_version: z.string(),
  idempotency_key: z.string().max(255).optional(),
  request_id: z.string().optional(),
  user_agent: z.string().optional(),
  accept_language: z.string().optional(),
  signature: z.string().optional(),
  timestamp: z.string().optional(),
});

const META_HEADERS: Record<string, string> = {
  api_version: 'api-version',
  idempotency_key: 'idempotency-key',
  request_id: 'request-id',
  user_agent: 'user-agent',
  accept_language: 'accept-language',
  signature: 'signature',
  timestamp: 'timestamp',
};

interface ACPMcpTool {
  name: string;
  description: string;
  method: 'GET' | 'POST';
  path: (id: string) => string;
  needsId: boolean;
  payload?: { schema: z.ZodType; required: boolean };
}

const ACP_MCP_TOOLS: ACPMcpTool[] = [
  {
    name: 'create_checkout_session',
    description: 'Create a checkout session from line items, currency and capabilities. Maps to POST /checkout_sessions.',
    method: 'POST',
    path: () => '/checkout_sessions',
    needsId: false,
    payload: { schema: ACPCreateCheckoutSessionRequestSchema, required: true },
  },
  {
    name: 'get_checkout_session',
    description: 'Retrieve the current state of a checkout session. Maps to GET /checkout_sessions/{id}.',
    method: 'GET',
    path: (id) => `/checkout_sessions/${encodeURIComponent(id)}`,
    needsId: true,
  },
  {
    name: 'update_checkout_session',
    description: 'Update items, fulfillment details or selected options. Maps to POST /checkout_sessions/{id}.',
    method: 'POST',
    path: (id) => `/checkout_sessions/${encodeURIComponent(id)}`,
    needsId: true,
    payload: { schema: ACPUpdateCheckoutSessionRequestSchema, required: true },
  },
  {
    name: 'complete_checkout_session',
    description: 'Submit payment and finalize the order. Maps to POST /checkout_sessions/{id}/complete.',
    method: 'POST',
    path: (id) => `/checkout_sessions/${encodeURIComponent(id)}/complete`,
    needsId: true,
    payload: { schema: ACPCompleteCheckoutSessionRequestSchema, required: true },
  },
  {
    name: 'cancel_checkout_session',
    description: 'Cancel a checkout session, optionally with an intent trace. Maps to POST /checkout_sessions/{id}/cancel.',
    method: 'POST',
    path: (id) => `/checkout_sessions/${encodeURIComponent(id)}/cancel`,
    needsId: true,
    payload: { schema: ACPCancelCheckoutSessionRequestSchema, required: false },
  },
];

const JsonRpcRequestSchema = z.looseObject({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
});

const ToolCallParamsSchema = z.looseObject({
  name: z.string(),
  arguments: z.looseObject({}).optional(),
});

type JsonRpcId = string | number | null;

/**
 * The ACP MCP transport binding: the five checkout tools over JSON-RPC 2.0
 * (Streamable HTTP, JSON responses). Tool calls are dispatched to the REST
 * handlers: `meta` becomes the protocol headers, `id` the path parameter
 * and `payload` the request body; the connection's Authorization applies to
 * every call. Results are the REST response bodies as-is; errors are
 * JSON-RPC -32000 with the ACP Error in `data`.
 */
export class ACPMcpEndpoint {
  public constructor(
    private readonly serverInfo: { name: string; version: string },
    /** Handles a REST request, e.g. the ACP server's own fetch. */
    private readonly rest: (request: Request) => Promise<Response>,
  ) {}

  public async handle(request: Request, restBaseUrl: string): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'POST' } });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonRpcResponse(null, { error: { code: JSON_RPC_PARSE_ERROR, message: 'Parse error' } });
    }

    const message = JsonRpcRequestSchema.safeParse(body);

    if (!message.success) {
      return jsonRpcResponse(null, { error: { code: JSON_RPC_INVALID_REQUEST, message: 'Invalid Request' } });
    }

    // Notifications (no id) are acknowledged without a response body.
    if (message.data.id === undefined) {
      return new Response(null, { status: 202 });
    }

    const id = message.data.id;

    switch (message.data.method) {
      case 'initialize':
        return jsonRpcResponse(id, {
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: this.serverInfo,
          },
        });
      case 'ping':
        return jsonRpcResponse(id, { result: {} });
      case 'tools/list':
        return jsonRpcResponse(id, { result: { tools: ACP_MCP_TOOLS.map(toToolDefinition) } });
      case 'tools/call':
        return jsonRpcResponse(id, await this.callTool(message.data.params, request, restBaseUrl));
      default:
        return jsonRpcResponse(id, { error: { code: JSON_RPC_METHOD_NOT_FOUND, message: `Method not found: ${message.data.method}` } });
    }
  }

  private async callTool(
    params: unknown,
    mcpRequest: Request,
    restBaseUrl: string,
  ): Promise<{ result: unknown } | { error: { code: number; message: string; data?: unknown } }> {
    const call = ToolCallParamsSchema.safeParse(params);
    const tool = call.success ? ACP_MCP_TOOLS.find((candidate) => candidate.name === call.data.name) : undefined;

    if (!call.success || !tool) {
      return { error: { code: JSON_RPC_INVALID_PARAMS, message: `Unknown tool: ${call.success ? call.data.name : ''}` } };
    }

    const args = call.data.arguments ?? {};
    const meta = ACPMcpMetaSchema.safeParse(args['meta']);
    const resourceId = args['id'];
    const payload = args['payload'];

    if (!meta.success) {
      return { error: { code: JSON_RPC_INVALID_PARAMS, message: 'meta.api_version is required' } };
    }

    if (tool.needsId && (typeof resourceId !== 'string' || resourceId.length === 0)) {
      return { error: { code: JSON_RPC_INVALID_PARAMS, message: 'id is required' } };
    }

    if (tool.payload?.required && (typeof payload !== 'object' || payload === null)) {
      return { error: { code: JSON_RPC_INVALID_PARAMS, message: 'payload is required' } };
    }

    const headers = new Headers({ accept: 'application/json' });
    const authorization = mcpRequest.headers.get('authorization');

    if (authorization) {
      headers.set('authorization', authorization);
    }

    for (const [field, header] of Object.entries(META_HEADERS)) {
      const value = meta.data[field];
      if (typeof value === 'string') {
        headers.set(header, value);
      }
    }

    // REST requires a key on every POST; tool calls without one get a
    // fresh key, so retries of such calls are not deduplicated.
    if (tool.method === 'POST' && !headers.has('idempotency-key')) {
      headers.set('idempotency-key', crypto.randomUUID());
    }

    const hasBody = tool.method === 'POST' && payload !== undefined;

    if (hasBody) {
      headers.set('content-type', 'application/json');
    }

    const response = await this.rest(new Request(`${restBaseUrl}${tool.path(typeof resourceId === 'string' ? resourceId : '')}`, {
      method: tool.method,
      headers,
      ...(hasBody ? { body: JSON.stringify(payload) } : {}),
    }));
    const text = await response.text();
    const result: unknown = text ? JSON.parse(text) : {};

    if (response.ok) {
      return { result };
    }

    const message = typeof result === 'object' && result !== null && typeof Reflect.get(result, 'message') === 'string'
      ? String(Reflect.get(result, 'message'))
      : `HTTP ${response.status}`;

    return { error: { code: JSON_RPC_ACP_ERROR, message, data: result } };
  }
}

function toToolDefinition(tool: ACPMcpTool): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    meta: z.toJSONSchema(ACPMcpMetaSchema, { io: 'input', unrepresentable: 'any' }),
  };
  const required = ['meta'];

  if (tool.needsId) {
    properties['id'] = { type: 'string', description: 'Checkout session id' };
    required.push('id');
  }

  if (tool.payload) {
    properties['payload'] = z.toJSONSchema(tool.payload.schema, { io: 'input', unrepresentable: 'any' });
    if (tool.payload.required) {
      required.push('payload');
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: { type: 'object', properties, required },
  };
}

function jsonRpcResponse(id: JsonRpcId, outcome: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, ...outcome }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
