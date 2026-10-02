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
import { ReactionaryUCPIdentity, type UCPBearerResolution } from './reactionary-ucp-identity.js';
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
  public readonly identity?: ReactionaryUCPIdentity;

  public constructor(
    private readonly clientFactory: ReactionaryUCPClientFactory<TClient>,
    private readonly options: ReactionaryUCPServerOptions = {},
  ) {
    const cache = this.options.sessionCache ?? new MemoryCache();
    this.sessionStore = new ReactionaryUCPSessionStore(
      cache,
      this.options.sessionTtlSeconds ?? 60 * 60 * 24,
    );

    if (this.options.identity) {
      this.identity = new ReactionaryUCPIdentity(this.options.identity, cache);
    }
  }

  public async fetch(request: Request): Promise<Response> {
    return this.handleFetch(request);
  }

  private async handleFetch(request: Request): Promise<Response> {
    const sessionId = getOrCreateSessionId(request);
    const bearerResolution = await this.identity?.resolveBearer(request);

    if (bearerResolution instanceof Response) {
      return bearerResolution;
    }

    const requestContext = await this.createRequestContext(sessionId, bearerResolution);
    const client = this.clientFactory(requestContext);

    const response = await this.handleRequest(request, client, sessionId, bearerResolution);

    if (bearerResolution) {
      await this.identity?.persistBearerSession(bearerResolution, requestContext.session);
    } else {
      await this.sessionStore.put(sessionId, requestContext.session);
    }

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
    bearerResolution?: UCPBearerResolution,
  ): Promise<RequestContext> {
    const requestContext = createInitialRequestContext();

    if (bearerResolution) {
      requestContext.session = bearerResolution.session;
      return requestContext;
    }

    const restoredSession = await this.sessionStore.get(sessionId);

    if (restoredSession) {
      requestContext.session = restoredSession;
    }

    return requestContext;
  }

  private async handleRequest(
    request: Request,
    client: TClient,
    sessionId: string,
    bearerResolution?: UCPBearerResolution,
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
      return jsonResponse(createUCPProfile(client, this.options.profile, this.identity?.getScopeNames()));
    }

    if (this.identity) {
      const identityResponse = await this.identity.handleHttp(request, route.path);

      if (identityResponse) {
        return identityResponse;
      }

      const accessResponse = this.identity.checkAccess(request.method, route.path, bearerResolution);

      if (accessResponse) {
        return accessResponse;
      }
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
