import {
  createInitialRequestContext,
  MemoryCache,
  type RequestContext,
} from '@reactionary/core';
import {
  type ReactionaryUCPClient,
  type ReactionaryUCPClientFactory,
  type ReactionaryUCPHttpHandler,
  type ReactionaryUCPNodeRequestHandler,
  type ReactionaryUCPProfile,
  type ReactionaryUCPProfileOptions,
  type ReactionaryUCPServerOptions,
} from './reactionary-ucp-common.js';
import { getOrCreateSessionId, jsonResponse, sendWebResponse, toWebRequest, UCP_SESSION_ID_HEADER } from './reactionary-ucp-http.js';
import { createUCPProfile, getRequestRoute } from './reactionary-ucp-profile.js';
import { handleRestRequest, UCPHttpError } from './reactionary-ucp-rest.js';
import { ReactionaryUCPSessionStore } from './reactionary-ucp-session-store.js';

export type {
  ReactionaryUCPClient,
  ReactionaryUCPClientFactory,
  ReactionaryUCPHttpHandler,
  ReactionaryUCPNodeRequestHandler,
  ReactionaryUCPProfile,
  ReactionaryUCPProfileOptions,
  ReactionaryUCPServerOptions,
};

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

    const response = await this.handleRequest(request, client, sessionId);
    await this.sessionStore.put(sessionId, requestContext.session);
    response.headers.set(UCP_SESSION_ID_HEADER, sessionId);

    const requestId = request.headers.get('Request-Id');
    if (requestId) {
      response.headers.set('Request-Id', requestId);
    }

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
    sessionId: string,
  ): Promise<Response> {
    const route = getRequestRoute(request, this.options.profile);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          allow: 'GET, HEAD, OPTIONS, POST, PUT',
        },
      });
    }

    if (route.path === '/.well-known/ucp' && request.method === 'GET') {
      return jsonResponse(createUCPProfile(client, this.options.profile));
    }

    try {
      const restResponse = await handleRestRequest(
        request,
        client,
        route.path,
        sessionId,
        this.sessionStore,
        this.options.profile?.paymentHandlers,
      );

      if (restResponse) {
        return restResponse;
      }
    } catch (error) {
      if (error instanceof UCPHttpError) {
        return jsonResponse(error.body, { status: error.status });
      }

      throw error;
    }

    return jsonResponse({
      error: {
        code: 'NOT_FOUND',
        message: `No UCP route matched ${request.method} ${route.path}.`,
      },
    }, {
      status: 404,
      omitBody: request.method === 'HEAD',
    });
  }
}
