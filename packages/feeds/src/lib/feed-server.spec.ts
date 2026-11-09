import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReactionaryFeedServer } from './feed-server.js';
import {
  ReactionaryFeedTransformerRegistry,
  type ReactionaryFeedTransformer,
} from './feed-transformer.js';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedDefinition,
} from './feed-types.js';

const testFeed: ReactionaryFeedDefinition = {
  languageContext: {
    locale: 'fi-FI',
    currencyCode: 'EUR',
  },
  search: {
    term: 'shoes',
    facets: [],
    filters: [],
    paginationOptions: {
      pageNumber: 1,
      pageSize: 25,
    },
  },
  productUrlBase: 'https://shop.example/{lang}/products/{slug}',
  sellerName: 'Reactionary Shop',
};

const httpServers: Server[] = [];

describe('ReactionaryFeedServer node handler', () => {
  afterEach(async () => {
    await Promise.all(
      httpServers.splice(0).map(
        (httpServer) =>
          new Promise<void>((resolve) => {
            httpServer.closeAllConnections();
            httpServer.close(() => resolve());
          }),
      ),
    );
  });

  it('answers 400 for a malformed Host header without rejecting', async () => {
    const harness = await startHarness(createStreamingTransformer(['feed']));

    const raw = await sendRawRequest(
      harness.port,
      'GET /feeds/main/outputs/test HTTP/1.1\r\nHost: not a host\r\nConnection: close\r\n\r\n',
    );

    expect(raw).toMatch(/^HTTP\/1\.1 400 /);
    expect(raw).toContain('{"error":"Bad request"}');
    await expectHandlersFulfilled(harness.handlerCalls);
  });

  it('answers a generic 500 when the feed fails before producing output', async () => {
    const harness = await startHarness(
      createFailingTransformer([], 'secret backend failure'),
    );

    const response = await fetch(`${harness.baseUrl}/feeds/main/outputs/test`);
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(body).toBe('{"error":"Internal server error"}');
    await expectHandlersFulfilled(harness.handlerCalls);
  });

  it('answers a generic 500 when the client factory throws', async () => {
    const harness = await startHarness(createStreamingTransformer(['feed']), {
      clientFactory: () => {
        throw new Error('secret backend failure');
      },
    });

    const response = await fetch(`${harness.baseUrl}/feeds/main/outputs/test`);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"Internal server error"}');
    await expectHandlersFulfilled(harness.handlerCalls);
  });

  it('destroys the connection when the feed fails after output was sent', async () => {
    const harness = await startHarness(
      createFailingTransformer(['first chunk'], 'secret backend failure'),
    );

    const response = await fetch(`${harness.baseUrl}/feeds/main/outputs/test`);

    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow();
    await expectHandlersFulfilled(harness.handlerCalls);
  });

  it('streams a successful feed to the client', async () => {
    const harness = await startHarness(
      createStreamingTransformer(['first,', 'second']),
    );

    const response = await fetch(`${harness.baseUrl}/feeds/main/outputs/test`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('first,second');
    await expectHandlersFulfilled(harness.handlerCalls);
  });

  it('aborts the web request and stops the feed when the client disconnects', async () => {
    const observed = { cleanedUp: false };
    const harness = await startHarness(createEndlessTransformer(observed));
    const fetchSpy = vi.spyOn(harness.feedServer, 'fetch');
    const abortController = new AbortController();

    const response = await fetch(`${harness.baseUrl}/feeds/main/outputs/test`, {
      signal: abortController.signal,
    });
    const reader = response.body?.getReader();
    await reader?.read();

    const webRequest = fetchSpy.mock.calls[0]?.[0];
    expect(webRequest?.signal.aborted).toBe(false);

    abortController.abort();

    await vi.waitFor(() => {
      expect(webRequest?.signal.aborted).toBe(true);
      expect(observed.cleanedUp).toBe(true);
    });
    await expectHandlersFulfilled(harness.handlerCalls);
  });
});

interface Harness {
  feedServer: ReactionaryFeedServer;
  port: number;
  baseUrl: string;
  handlerCalls: Promise<void>[];
}

async function startHarness(
  transformer: ReactionaryFeedTransformer,
  options: { clientFactory?: () => ReactionaryFeedClient } = {},
): Promise<Harness> {
  const registry = new ReactionaryFeedTransformerRegistry();
  registry.register(transformer);

  const feedServer = new ReactionaryFeedServer(
    options.clientFactory ?? createUnusedClient,
    { feeds: { main: testFeed }, registry },
  );
  const handler = feedServer.toNodeHandler();
  const handlerCalls: Promise<void>[] = [];
  // Passing the handler on without a catch mirrors how consumers use it, so
  // every call is recorded to assert that none of them rejects.
  const httpServer = createServer((request, response) => {
    handlerCalls.push(handler(request, response));
  });
  httpServers.push(httpServer);

  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');

  const address = httpServer.address();

  if (!isAddressInfo(address)) {
    throw new Error('Expected the test server to listen on a TCP port.');
  }

  return {
    feedServer,
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}`,
    handlerCalls,
  };
}

function isAddressInfo(
  address: string | AddressInfo | null,
): address is AddressInfo {
  return typeof address === 'object' && address !== null;
}

async function expectHandlersFulfilled(
  handlerCalls: Promise<void>[],
): Promise<void> {
  await vi.waitFor(() => expect(handlerCalls.length).toBeGreaterThan(0));
  const results = await Promise.allSettled(handlerCalls);

  expect(results.map((result) => result.status)).toEqual(
    results.map(() => 'fulfilled'),
  );
}

async function sendRawRequest(port: number, payload: string): Promise<string> {
  const socket = connect(port, '127.0.0.1');
  const chunks: Buffer[] = [];

  socket.on('data', (chunk: Buffer) => chunks.push(chunk));
  await once(socket, 'connect');
  socket.write(payload);
  await once(socket, 'close');

  return Buffer.concat(chunks).toString('utf8');
}

function createUnusedClient(): ReactionaryFeedClient {
  const unused = (): never => {
    throw new Error('The test transformers do not read products.');
  };

  return {
    productSearch: { queryByTerm: unused },
    product: { getBySKU: unused },
    price: { getCustomerPrice: unused, getListPrice: unused },
    inventory: { getBySKU: unused },
  };
}

function createTransformer(
  transform: ReactionaryFeedTransformer['transform'],
): ReactionaryFeedTransformer {
  return {
    id: 'test',
    title: 'Test',
    output: { contentType: 'text/plain', fileExtension: 'txt' },
    transform,
  };
}

function createStreamingTransformer(
  chunks: string[],
): ReactionaryFeedTransformer {
  return createTransformer(async function* () {
    yield* chunks;
  });
}

function createFailingTransformer(
  chunks: string[],
  message: string,
): ReactionaryFeedTransformer {
  return createTransformer(async function* () {
    yield* chunks;
    // Gives the already written chunks time to reach the client first.
    await new Promise((resolve) => setTimeout(resolve, 20));
    throw new Error(message);
  });
}

function createEndlessTransformer(observed: {
  cleanedUp: boolean;
}): ReactionaryFeedTransformer {
  return createTransformer(async function* () {
    try {
      for (;;) {
        yield 'chunk';
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    } finally {
      observed.cleanedUp = true;
    }
  });
}
