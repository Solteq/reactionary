import {
  createInitialRequestContext,
  getHttpProtocolResultAttributes,
  MemoryCache,
  traceProtocolInvocation,
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
  type UCPPaymentHandlers,
} from './reactionary-ucp-common.js';
import { getOrCreateSessionId, jsonResponse, sendWebResponse, toWebRequest, UCP_SESSION_ID_HEADER } from './reactionary-ucp-http.js';
import { ReactionaryUCPIdentity, type UCPBearerResolution } from './reactionary-ucp-identity.js';
import { resolveLanguageContext } from './reactionary-ucp-localization.js';
import {
  DEFAULT_UCP_PAYMENT_AUTHORIZATION_WAIT,
  DEFAULT_UCP_PLACEHOLDER_EMAIL,
  type UCPTestPaymentHandler,
} from './reactionary-ucp-checkout-session.js';
import { createUCPError, UCP_VERSION } from './reactionary-ucp-mapping.js';
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

    if (this.options.anonymousOrderEmail) {
      console.warn(
        '\n'
        + '############################################################################\n'
        + '# UCP: anonymousOrderEmail is set. Checkouts WITHOUT a buyer email will    #\n'
        + '# place REAL orders under this address. The buyer cannot be sent a        #\n'
        + '# receipt, which may make such purchases illegal in some jurisdictions.   #\n'
        + '# Use for conformance/test environments only.                             #\n'
        + '############################################################################',
      );
    }

    if (this.options.testPaymentHandlers?.length) {
      assertTestPaymentHandlerDelegates(this.options.testPaymentHandlers, this.options.profile?.paymentHandlers ?? {});
      console.warn(
        '\n'
        + '############################################################################\n'
        + '# UCP: testPaymentHandlers is set. Checkouts paying with a test handler   #\n'
        + '# are charged through its REAL delegate handler with substitute           #\n'
        + '# credentials. Use for conformance/test environments only.                #\n'
        + '############################################################################\n'
        + `Test payment handlers: ${this.options.testPaymentHandlers.map((handler) => `${handler.id} -> ${handler.delegateHandlerId}`).join(', ')}`,
      );
    }
  }

  public async fetch(request: Request): Promise<Response> {
    const route = getRequestRoute(request, this.options.profile);

    return traceProtocolInvocation(
      {
        protocol: 'ucp',
        operation: `${request.method} ${getUcpOperationPath(route.path)}`,
        attributes: { 'http.request.method': request.method },
      },
      () => this.handleFetch(request),
      getHttpProtocolResultAttributes,
    );
  }

  private async handleFetch(request: Request): Promise<Response> {
    const bearerResolution = await this.identity?.resolveBearer(request);

    if (bearerResolution instanceof Response) {
      return bearerResolution;
    }

    const sessionId = bearerResolution
      ? getOrCreateSessionId(request)
      : await this.resolveSessionId(request);

    const requestContext = await this.createRequestContext(sessionId, bearerResolution);
    const negotiatedLanguageContext = await resolveLanguageContext(
      request,
      requestContext.session,
      this.options.localization,
    );

    if (negotiatedLanguageContext) {
      requestContext.languageContext = negotiatedLanguageContext;
    }

    const client = this.clientFactory(requestContext);

    const response = await this.handleRequest(request, client, requestContext, sessionId, bearerResolution);

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

  /**
   * Requests addressing a cart or checkout session resume the session that
   * created it: agents rarely echo the UCP session header, but backends scope
   * carts to that session's (anonymous) identity.
   */
  private async resolveSessionId(request: Request): Promise<string> {
    const route = getRequestRoute(request, this.options.profile);
    const resourceId = /^\/(?:carts|checkout-sessions)\/([^/]+)/.exec(route.path)?.[1];
    const boundSessionId = resourceId
      ? await this.sessionStore.getResourceSession(decodeURIComponent(resourceId))
      : undefined;

    return boundSessionId ?? getOrCreateSessionId(request);
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
    requestContext: RequestContext,
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

    const agentVersion = getAgentVersion(request);
    // Versions are YYYY-MM-DD dates, so lexical order is chronological.
    if (agentVersion && agentVersion > UCP_VERSION) {
      return jsonResponse(
        createUCPError('version_unsupported', `UCP version ${agentVersion} is not supported; this business supports ${UCP_VERSION}.`),
        { status: 422 },
      );
    }

    try {
      const restResponse = await handleRestRequest(
        request,
        client,
        route.path,
        sessionId,
        this.sessionStore,
        {
          paymentHandlers: this.options.profile?.paymentHandlers ?? {},
          placeholderEmail: this.options.placeholderEmail ?? DEFAULT_UCP_PLACEHOLDER_EMAIL,
          paymentAuthorizationWait: {
            ...DEFAULT_UCP_PAYMENT_AUTHORIZATION_WAIT,
            ...this.options.paymentAuthorizationWait,
          },
          identity: requestContext.session.identityContext.identity,
          merchantUrl: this.options.profile?.merchant?.url,
          anonymousOrderEmail: this.options.anonymousOrderEmail,
          testPaymentHandlers: this.options.testPaymentHandlers,
        },
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

function assertTestPaymentHandlerDelegates(
  testHandlers: UCPTestPaymentHandler[],
  paymentHandlers: UCPPaymentHandlers,
): void {
  const advertised = new Set(Object.values(paymentHandlers).flat().map((handler) => handler.id));

  for (const handler of testHandlers) {
    if (!advertised.has(handler.delegateHandlerId)) {
      throw new Error(
        `UCP test payment handler '${handler.id}' delegates to '${handler.delegateHandlerId}', which is not an advertised payment handler.`,
      );
    }
  }
}

function getAgentVersion(request: Request): string | undefined {
  const agent = request.headers.get('UCP-Agent');

  return agent ? /version="([^"]*)"/.exec(agent)?.[1] : undefined;
}

function getUcpOperationPath(path: string): string {
  return path
    .replace(/^\/carts\/[^/]+/, '/carts/{id}')
    .replace(/^\/checkout-sessions\/[^/]+/, '/checkout-sessions/{id}')
    .replace(/^\/orders\/[^/]+/, '/orders/{id}');
}
