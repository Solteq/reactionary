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
import { ReactionarySitemapGenerator } from './sitemap-generator.js';
import {
  toSitemapIndexXml,
  toSitemapXml,
} from './sitemap-xml.js';
import type {
  ReactionaryFeedTransformer,
  ReactionaryFeedTransformerRegistry,
} from './feed-transformer.js';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedClientFactory,
  ReactionaryFeedDefinition,
  ReactionaryFeedInventoryOptions,
  ReactionaryFeedProcessingOptions,
  ReactionarySitemapOptions,
} from './feed-types.js';

export interface ReactionaryFeedServerOptions
  extends ReactionaryFeedInventoryOptions,
    ReactionaryFeedProcessingOptions {
  basePath?: string;
  feeds: Record<string, ReactionaryFeedDefinition>;
  sitemaps?: ReactionarySitemapOptions;
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
    const sitemapRoute = parseSitemapRoute(request, this.options.sitemaps);

    if (sitemapRoute.kind === 'index') {
      return this.generateSitemapIndexResponse(request);
    }

    if (sitemapRoute.kind === 'source') {
      return this.generateSitemapResponse(request, sitemapRoute.sourceId);
    }

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
    const generator = new ReactionaryFeedGenerator(client, {
      defaultFulfillmentCenterKeys: this.options.defaultFulfillmentCenterKeys,
      productConcurrency: this.options.productConcurrency,
    });
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

  private async generateSitemapIndexResponse(request: Request): Promise<Response> {
    const sitemaps = this.options.sitemaps;

    if (!sitemaps) {
      return jsonResponse({
        error: 'Sitemaps are not configured.',
      }, { status: 404, omitBody: request.method === 'HEAD' });
    }

    const baseUrl = trimTrailingSlash(sitemaps.baseUrl);
    const sourceIds = getIncludedSitemapSourceIds(sitemaps);
    const xml = await toSitemapIndexXml(
      sourceIds.map((sourceId) => `${baseUrl}/sitemaps/${encodeURIComponent(sourceId)}.xml`),
    );

    return xmlResponse(xml, {
      omitBody: request.method === 'HEAD',
    });
  }

  private async generateSitemapResponse(
    request: Request,
    sourceId: string,
  ): Promise<Response> {
    const sitemaps = this.options.sitemaps;

    if (!sitemaps) {
      return jsonResponse({
        error: 'Sitemaps are not configured.',
      }, { status: 404, omitBody: request.method === 'HEAD' });
    }

    if (!getIncludedSitemapSourceIds(sitemaps).includes(sourceId)) {
      return jsonResponse({
        error: `Sitemap source not found: ${sourceId}`,
      }, { status: 404, omitBody: request.method === 'HEAD' });
    }

    const source = sitemaps.sources[sourceId];

    if (!source) {
      return jsonResponse({
        error: `Sitemap source not found: ${sourceId}`,
      }, { status: 404, omitBody: request.method === 'HEAD' });
    }

    const requestContext = createInitialRequestContext();
    const languageContext = source.type === 'products'
      ? this.options.feeds[source.feed]?.languageContext
      : source.languageContext;

    if (languageContext) {
      requestContext.languageContext = languageContext;
    }

    const client = this.clientFactory(requestContext);
    const generator = new ReactionarySitemapGenerator(
      client,
      this.options.feeds,
      {
        defaultFulfillmentCenterKeys: this.options.defaultFulfillmentCenterKeys,
        productConcurrency: this.options.productConcurrency,
      },
    );
    const xml = await toSitemapXml(generator.entries(source, requestContext));

    return xmlResponse(xml, {
      headers: {
        'content-disposition': `attachment; filename="${sourceId}.xml"`,
      },
      omitBody: request.method === 'HEAD',
    });
  }
}

type FeedRoute =
  | { kind: 'feeds' }
  | { kind: 'transformers' }
  | { kind: 'output'; feedId: string; transformerId: string }
  | { kind: 'not-found' };

type SitemapRoute =
  | { kind: 'index' }
  | { kind: 'source'; sourceId: string }
  | { kind: 'not-found' };

function parseSitemapRoute(
  request: Request,
  sitemaps: ReactionarySitemapOptions | undefined,
): SitemapRoute {
  if (!sitemaps) {
    return { kind: 'not-found' };
  }

  const pathname = new URL(request.url).pathname;

  if (pathname === '/sitemaps.xml') {
    return { kind: 'index' };
  }

  const match = /^\/sitemaps\/([^/]+)\.xml$/.exec(pathname);

  if (match) {
    return {
      kind: 'source',
      sourceId: decodeURIComponent(match[1] ?? ''),
    };
  }

  return { kind: 'not-found' };
}

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

function xmlResponse(
  body: string,
  options: {
    headers?: Record<string, string>;
    omitBody?: boolean;
  } = {},
): Response {
  return new Response(options.omitBody ? null : body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      ...options.headers,
    },
  });
}

function getIncludedSitemapSourceIds(
  sitemaps: ReactionarySitemapOptions,
): string[] {
  return sitemaps.include ?? Object.keys(sitemaps.sources);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
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
