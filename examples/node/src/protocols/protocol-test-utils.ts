import 'dotenv/config';
import {
  MemoryCache,
  NoOpCache,
  createInitialRequestContext,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import {
  ACP_API_VERSION,
  ReactionaryACPServer,
  createBearerTokenAuthenticator,
  createTokenizedCardHandler,
} from '@reactionary/acp';
import { DEFAULT_UCP_LOCALIZATION_RULES, ReactionaryUCPServer } from '@reactionary/ucp';
import { withAlgoliaCapabilities } from '@reactionary/algolia';
import { withCommercetoolsCapabilities } from '@reactionary/commercetools';
import { withMagentoCapabilities } from '@reactionary/magento';
import { withMedusaCapabilities } from '@reactionary/medusa';
import { withMeilisearchCapabilities } from '@reactionary/meilisearch';
import { ClientBuilder } from '@reactionary/core';
import {
  getAlgoliaTestConfiguration,
  getCommercetoolsTestConfiguration,
  getMagentoTestConfiguration,
  getMedusaTestConfiguration,
  getMeilisearchTestConfiguration,
} from '../utils.js';

export const PROTOCOL_TEST_TIMEOUT = 120_000;

export enum ProtocolBackend {
  COMMERCETOOLS = 'Commercetools',
  MEDUSA = 'Medusa',
  MAGENTO = 'Magento',
}

export enum ProtocolSearchEngine {
  NATIVE = 'NativeSearch',
  ALGOLIA = 'Algolia',
  MEILISEARCH = 'Meilisearch',
}

/**
 * The backends every protocol e2e suite runs against. Magento is wired up and
 * can be enabled with E2E_PROTOCOL_MAGENTO=true, but is not currently expected
 * to pass, so it is opt-in.
 */
export function getProtocolBackends(): ProtocolBackend[] {
  const backends = [ProtocolBackend.COMMERCETOOLS, ProtocolBackend.MEDUSA];

  if (process.env['E2E_PROTOCOL_MAGENTO'] === 'true') {
    backends.push(ProtocolBackend.MAGENTO);
  }

  return backends;
}

export function getProtocolSearchEngines(): ProtocolSearchEngine[] {
  return [
    ProtocolSearchEngine.NATIVE,
    ProtocolSearchEngine.ALGOLIA,
    ProtocolSearchEngine.MEILISEARCH,
  ];
}

export function hasBackendEnv(backend: ProtocolBackend): boolean {
  switch (backend) {
    case ProtocolBackend.COMMERCETOOLS:
      return hasEnv('CTP_PROJECT_KEY', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_API_URL', 'CTP_AUTH_URL');
    case ProtocolBackend.MEDUSA:
      return hasEnv('MEDUSA_API_URL', 'MEDUSA_PUBLISHABLE_KEY');
    case ProtocolBackend.MAGENTO:
      return hasEnv('MAGENTO_BASE_URL', 'MAGENTO_ADMIN_API_KEY');
  }
}

export function hasSearchEnv(search: ProtocolSearchEngine): boolean {
  switch (search) {
    case ProtocolSearchEngine.NATIVE:
      return true;
    case ProtocolSearchEngine.ALGOLIA:
      return hasEnv('ALGOLIA_APP_ID', 'ALGOLIA_API_KEY', 'ALGOLIA_INDEX');
    case ProtocolSearchEngine.MEILISEARCH:
      return hasEnv('MEILISEARCH_API_URL', 'MEILISEARCH_API_KEY', 'MEILISEARCH_INDEX');
  }
}

function hasEnv(...names: string[]): boolean {
  return names.every((name) => !!process.env[name]);
}

/**
 * Builds a Reactionary client that serves the protocol servers: the chosen
 * commerce backend provides carts, checkout, products, prices and inventory,
 * while the (optional) external search engine overrides product search.
 */
export function createProtocolClient(
  backend: ProtocolBackend,
  search: ProtocolSearchEngine,
  contextOverrides: Partial<RequestContext> = {},
  cache: Cache = new NoOpCache(),
) {
  const context = { ...createInitialRequestContext(), ...contextOverrides };
  let builder = new ClientBuilder(context).withCache(cache);

  if (backend === ProtocolBackend.COMMERCETOOLS) {
    builder = builder.withCapability(
      withCommercetoolsCapabilities(getCommercetoolsTestConfiguration(), {
        cart: { enabled: true },
        product: { enabled: true },
        category: { enabled: true },
        checkout: { enabled: true },
        identity: { enabled: true },
        inventory: { enabled: true },
        order: { enabled: true },
        price: { enabled: true },
        productSearch: { enabled: true },
      }),
    );
  }

  if (backend === ProtocolBackend.MEDUSA) {
    builder = builder.withCapability(
      withMedusaCapabilities(getMedusaTestConfiguration(), {
        cart: { enabled: true },
        product: { enabled: true },
        category: { enabled: true },
        checkout: { enabled: true },
        identity: { enabled: true },
        inventory: { enabled: true },
        order: { enabled: true },
        price: { enabled: true },
        productSearch: { enabled: true },
      }),
    );
  }

  if (backend === ProtocolBackend.MAGENTO) {
    builder = builder.withCapability(
      withMagentoCapabilities(getMagentoTestConfiguration(), {
        cart: { enabled: true },
        product: { enabled: true },
        category: { enabled: true },
        checkout: { enabled: true },
        identity: { enabled: true },
        inventory: { enabled: true },
        order: { enabled: true },
        price: { enabled: true },
        productSearch: { enabled: true },
      }),
    );
  }

  if (search === ProtocolSearchEngine.ALGOLIA) {
    builder = builder.withCapability(
      withAlgoliaCapabilities(getAlgoliaTestConfiguration(), {
        productSearch: { enabled: true },
      }),
    );
  }

  if (search === ProtocolSearchEngine.MEILISEARCH) {
    builder = builder.withCapability(
      withMeilisearchCapabilities(getMeilisearchTestConfiguration(), {
        productSearch: { enabled: true },
      }),
    );
  }

  return builder.build();
}

export const UCP_BASE_URL = 'https://shop.example.com/ucp';

export interface UcpServerHarness {
  server: ReactionaryUCPServer;
  /**
   * Builds a reactionary client that joins the session of the server's most
   * recent request. Backends scope resources to the (anonymous) session —
   * commercetools carts live under /me — so independent capability calls must
   * share the protocol session to see what the protocol flow created.
   */
  createCompanionClient(): ReturnType<typeof createProtocolClient>;
}

export function createUcpServer(
  backend: ProtocolBackend,
  search: ProtocolSearchEngine,
): ReactionaryUCPServer {
  return createUcpServerHarness(backend, search).server;
}

export function createUcpServerHarness(
  backend: ProtocolBackend,
  search: ProtocolSearchEngine,
): UcpServerHarness {
  let lastContext: Partial<RequestContext> = {};
  const server = new ReactionaryUCPServer(
    (requestContext) => {
      lastContext = requestContext;
      return createProtocolClient(backend, search, requestContext);
    },
    {
      sessionCache: new MemoryCache(),
      profile: {
        endpoint: UCP_BASE_URL,
        merchant: {
          name: 'Reactionary e2e shop',
          url: 'https://shop.example.com',
          contact: { email: 'support@example.com' },
        },
        keys: [],
        paymentHandlers: {
          'dev.reactionary.manual': [{ version: '2026-08-25', id: 'manual' }],
        },
      },
      localization: {
        rules: DEFAULT_UCP_LOCALIZATION_RULES,
      },
      paymentAuthorizationWait: { timeoutMs: 30_000, intervalMs: 500 },
    },
  );

  return {
    server,
    createCompanionClient: () => createProtocolClient(backend, search, lastContext),
  };
}

export const ACP_BASE_URL = 'https://shop.example.com/acp';
export const ACP_FEED_ID = 'e2e';
const ACP_E2E_TOKEN = 'acp-e2e-token';

export function createAcpServer(
  backend: ProtocolBackend,
  search: ProtocolSearchEngine = ProtocolSearchEngine.NATIVE,
): ReactionaryACPServer {
  return createAcpServerHarness(backend, search).server;
}

export interface AcpServerHarness {
  server: ReactionaryACPServer;
  /** See {@link UcpServerHarness.createCompanionClient}. */
  createCompanionClient(): ReturnType<typeof createProtocolClient>;
}

export function createAcpServerHarness(
  backend: ProtocolBackend,
  search: ProtocolSearchEngine = ProtocolSearchEngine.NATIVE,
): AcpServerHarness {
  const { languageContext } = createInitialRequestContext();
  let lastContext: Partial<RequestContext> = {};

  const server = new ReactionaryACPServer(
    (requestContext) => {
      lastContext = requestContext;
      return createProtocolClient(backend, search, requestContext);
    },
    {
      sessionCache: new MemoryCache(),
      paymentAuthorizationWait: { timeoutMs: 30_000, intervalMs: 500 },
      authenticate: createBearerTokenAuthenticator({ e2e: ACP_E2E_TOKEN }),
      paymentHandlers: [createTokenizedCardHandler({ psp: 'stripe', merchantId: 'acct_e2e' })],
      links: [{ type: 'terms_of_use', url: 'https://shop.example.com/terms' }],
      orderPermalinkUrl: 'https://shop.example.com/orders/{orderId}',
      productFeed: {
        feeds: {
          [ACP_FEED_ID]: {
            languageContext,
            search: {
              term: 'Bag',
              facets: [],
              filters: [],
              paginationOptions: {
                pageNumber: 1,
                pageSize: 5,
              },
            },
            pageSize: 5,
            maxPages: 1,
            productUrlBase: 'https://shop.example.com/products/{slug}',
          },
        },
      },
    },
  );

  return {
    server,
    createCompanionClient: () => createProtocolClient(backend, search, lastContext),
  };
}

interface FetchProtocolServer {
  fetch(request: Request): Promise<Response>;
}

export interface ProtocolResponse<TBody> {
  status: number;
  body: TBody;
  headers: Headers;
}

/**
 * Drives a protocol server like an HTTP client would, carrying the protocol
 * session header (ucp-session-id / acp-session-id) across calls so a test can
 * express a multi-request user journey.
 */
export class ProtocolSession {
  private sessionId: string | undefined;

  public constructor(
    private readonly server: FetchProtocolServer,
    private readonly sessionHeader: string,
    /** Headers sent with every request, e.g. a protocol version. */
    private readonly defaultHeaders: Record<string, string> = {},
    /** Headers computed per mutation, e.g. a fresh Idempotency-Key. */
    private readonly mutationHeaders: () => Record<string, string> = () => ({}),
  ) {}

  public async get<TBody>(url: string): Promise<ProtocolResponse<TBody>> {
    return this.send(new Request(url, { headers: this.createHeaders() }));
  }

  public async send<TBody>(request: Request): Promise<ProtocolResponse<TBody>> {
    const response = await this.server.fetch(request);
    this.sessionId = response.headers.get(this.sessionHeader) ?? this.sessionId;

    return {
      status: response.status,
      body: (await response.json()) as TBody,
      headers: response.headers,
    };
  }

  public async sendJson<TBody>(
    method: 'POST' | 'PUT',
    url: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<ProtocolResponse<TBody>> {
    return this.send(
      new Request(url, {
        method,
        headers: this.createHeaders({
          'content-type': 'application/json',
          ...this.mutationHeaders(),
          ...extraHeaders,
        }),
        body: JSON.stringify(body),
      }),
    );
  }

  private createHeaders(extra: Record<string, string> = {}): Headers {
    const headers = new Headers({ ...this.defaultHeaders, ...extra });

    if (this.sessionId) {
      headers.set(this.sessionHeader, this.sessionId);
    }

    return headers;
  }
}

export function createUcpSession(server: ReactionaryUCPServer): ProtocolSession {
  return new ProtocolSession(server, 'ucp-session-id');
}

export function createAcpSession(server: ReactionaryACPServer): ProtocolSession {
  return new ProtocolSession(
    server,
    'acp-session-id',
    {
      'api-version': ACP_API_VERSION,
      authorization: `Bearer ${ACP_E2E_TOKEN}`,
    },
    () => ({ 'idempotency-key': crypto.randomUUID() }),
  );
}
