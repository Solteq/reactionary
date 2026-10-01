import {
  createInitialRequestContext,
  MemoryCache,
  SessionSchema,
  type Cache,
  type RequestContext,
  type Session,
} from '@reactionary/core';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';

const ACP_SESSION_ID_HEADER = 'acp-session-id';
const SESSION_CACHE_KEY_PREFIX = 'reactionary:acp:session';
type ProtocolHeaders = Headers | Record<string, string>;

export type ReactionaryACPClientFactory<TClient = unknown> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryACPServerOptions {
  name?: string;
  version?: string;
  sessionCache?: Cache;
  sessionTtlSeconds?: number;
}

export interface ReactionaryACPHttpHandler {
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export type ReactionaryACPNodeRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

export class ReactionaryACPServer<TClient = unknown> {
  private readonly sessionStore: ReactionaryACPSessionStore;

  public constructor(
    private readonly clientFactory: ReactionaryACPClientFactory<TClient>,
    private readonly options: ReactionaryACPServerOptions = {},
  ) {
    this.sessionStore = new ReactionaryACPSessionStore(
      this.options.sessionCache ?? new MemoryCache(),
      this.options.sessionTtlSeconds ?? 60 * 60 * 24,
    );
  }

  public async fetch(request: Request): Promise<Response> {
    const sessionId = getOrCreateSessionId(request);
    const requestContext = await this.createRequestContext(sessionId);
    this.clientFactory(requestContext);

    const response = await this.handleRequest(request);
    await this.sessionStore.put(sessionId, requestContext.session);
    response.headers.set(ACP_SESSION_ID_HEADER, sessionId);

    return response;
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

  private async handleRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          allow: 'GET, HEAD, OPTIONS, POST',
        },
      });
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      return jsonResponse({
        name: this.options.name ?? '@reactionary/acp',
        version: this.options.version ?? '0.0.1',
        protocol: 'acp',
        status: 'ready',
        actions: [],
      }, { omitBody: request.method === 'HEAD' });
    }

    if (request.method === 'POST') {
      return jsonResponse({
        error: {
          code: 'ACP_ACTIONS_NOT_IMPLEMENTED',
          message:
            'The Reactionary ACP framework is mounted, but ACP actions have not been implemented yet.',
        },
      }, { status: 501 });
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

function getSessionId(request: Request): string | undefined {
  return request.headers.get(ACP_SESSION_ID_HEADER) ?? undefined;
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
