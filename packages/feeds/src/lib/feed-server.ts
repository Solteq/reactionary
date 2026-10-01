import {
  createInitialRequestContext,
} from '@reactionary/core';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import { createDefaultFeedRegistry } from './default-registry.js';
import { ReactionaryFeedGenerator } from './feed-generator.js';
import type {
  ReactionaryFeedTransformer,
  ReactionaryFeedTransformerRegistry,
} from './feed-transformer.js';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedClientFactory,
  ReactionaryFeedDefinition,
} from './feed-types.js';

export interface ReactionaryFeedServerOptions {
  basePath?: string;
  feeds: Record<string, ReactionaryFeedDefinition>;
  registry?: ReactionaryFeedTransformerRegistry;
}

export interface ReactionaryFeedHttpHandler {
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export type ReactionaryFeedNodeRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

export class ReactionaryFeedServer<
  TClient extends ReactionaryFeedClient = ReactionaryFeedClient,
> {
  private readonly registry: ReactionaryFeedTransformerRegistry;

  public constructor(
    private readonly clientFactory: ReactionaryFeedClientFactory<TClient>,
    private readonly options: ReactionaryFeedServerOptions,
  ) {
    this.registry = options.registry ?? createDefaultFeedRegistry();
  }

  public async fetch(request: Request): Promise<Response> {
    try {
      return await this.handleRequest(request);
    } catch (error) {
      return jsonResponse({
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  }

  public getHandler(): ReactionaryFeedHttpHandler {
    return {
      fetch: (request) => this.fetch(request),
      close: () => this.close(),
    };
  }

  public toNodeHandler(): ReactionaryFeedNodeRequestHandler {
    return async (request, response) => {
      const webResponse = await this.fetch(await toWebRequest(request));
      await sendWebResponse(response, webResponse);
    };
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  private async handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({
        error: `Unsupported method: ${request.method}`,
      }, {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      });
    }

    const route = parseFeedRoute(request, this.options.basePath);

    if (route.kind === 'feeds') {
      return jsonResponse({
        feeds: Object.keys(this.options.feeds),
      }, { omitBody: request.method === 'HEAD' });
    }

    if (route.kind === 'transformers') {
      return jsonResponse({
        transformers: this.registry.list(),
      }, { omitBody: request.method === 'HEAD' });
    }

    if (route.kind !== 'output') {
      return jsonResponse({
        error: 'Not found',
      }, { status: 404, omitBody: request.method === 'HEAD' });
    }

    const feed = this.options.feeds[route.feedId];
    const transformer = this.registry.get(route.transformerId);

    if (!feed) {
      return jsonResponse({
        error: `Feed not found: ${route.feedId}`,
      }, { status: 404 });
    }

    if (!transformer) {
      return jsonResponse({
        error: `Feed transformer not found: ${route.transformerId}`,
      }, { status: 404 });
    }

    return this.generateFeedResponse(
      request,
      route.feedId,
      feed,
      transformer,
    );
  }

  private generateFeedResponse(
    request: Request,
    feedId: string,
    feed: ReactionaryFeedDefinition,
    transformer: ReactionaryFeedTransformer,
  ): Response {
    const requestContext = createInitialRequestContext();
    requestContext.languageContext = feed.languageContext;
    const client = this.clientFactory(requestContext);
    const generator = new ReactionaryFeedGenerator(client);
    const output = transformer.transform(
      generator.products(feed, requestContext),
      {
        feedId,
        feed,
        options: transformer.defaultOptions,
      },
    );

    return new Response(
      request.method === 'HEAD' ? null : iterableToStream(output),
      {
        headers: {
          'content-type': transformer.output.contentType,
          'content-disposition': `attachment; filename="${feedId}.${transformer.output.fileExtension}"`,
        },
      },
    );
  }
}

type FeedRoute =
  | { kind: 'feeds' }
  | { kind: 'transformers' }
  | { kind: 'output'; feedId: string; transformerId: string }
  | { kind: 'not-found' };

function parseFeedRoute(request: Request, basePath = '/feeds'): FeedRoute {
  const pathname = getProtocolPathname(request, basePath);

  if (pathname === '/' || pathname === '') {
    return { kind: 'feeds' };
  }

  if (pathname === '/transformers') {
    return { kind: 'transformers' };
  }

  const match = /^\/([^/]+)\/outputs\/([^/]+)$/.exec(pathname);

  if (match) {
    return {
      kind: 'output',
      feedId: decodeURIComponent(match[1] ?? ''),
      transformerId: decodeURIComponent(match[2] ?? ''),
    };
  }

  return { kind: 'not-found' };
}

function getProtocolPathname(request: Request, basePath: string): string {
  const pathname = new URL(request.url).pathname;

  if (pathname === basePath) {
    return '/';
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length);
  }

  return pathname;
}

function iterableToStream(
  iterable: AsyncIterable<string | Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = iterable[Symbol.asyncIterator]();

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

function jsonResponse(
  body: unknown,
  options: {
    status?: number;
    headers?: Record<string, string>;
    omitBody?: boolean;
  } = {},
): Response {
  return new Response(options.omitBody ? null : JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...options.headers,
    },
  });
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = toWebHeaders(request.headers);
  const url = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? 'localhost'}`,
  );

  return new Request(url, {
    method: request.method,
    headers,
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
