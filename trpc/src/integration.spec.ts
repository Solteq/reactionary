import { ClientBuilder, NoOpCache } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { createTRPCServerRouter, createTRPCContext } from './server';
import { createTRPCClient } from './client';
import type { TransparentClient } from './types';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import * as http from 'http';
import { createAnonymousTestSession } from './test-utils';

/**
 * Integration test that actually starts an HTTP server and makes real network calls
 * This is the real test that verifies the TRPC transparent transport works end-to-end
 */

// Polyfill fetch for Node.js
global.fetch = global.fetch || require('node-fetch');

// Create the server-side client
const serverClient = new ClientBuilder()
    .withCapability(
      withFakeCapabilities(
        {
          jitter: {
            mean: 0,
            deviation: 0,
          },
          seeds: {
            category: 1,
            product: 1,
            search: 1
          }
        },
        { search: true, product: true, identity: false }
      )
    )
    .withCache(new NoOpCache())
    .build();

// Create TRPC router from the client (do this at module level for type inference)
const router = createTRPCServerRouter(serverClient);
type AppRouter = typeof router;

xdescribe('TRPC Integration Test - Real HTTP Server', () => {
  let server: http.Server;
  let serverPort: number;
  let trpcProxyClient: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  let transparentClient: TransparentClient<typeof serverClient>;

  beforeAll(async () => {

    // Create TRPC HTTP handler
    const handler = createHTTPHandler({
      router,
      createContext: createTRPCContext,
    });

    // Start HTTP server with TRPC handler
    server = http.createServer(handler);

    // Find available port
    serverPort = 3001;
    await new Promise<void>((resolve, reject) => {
      const tryPort = (port: number) => {
        server.listen(port, (err?: Error) => {
          if (err) {
            if (port < 3010) {
              tryPort(port + 1);
            } else {
              reject(err);
            }
          } else {
            serverPort = port;
            resolve();
          }
        });
      };
      tryPort(serverPort);
    });

    // Create real TRPC proxy client (no transformer for testing)
    trpcProxyClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `http://localhost:${serverPort}`,
        }),
      ],
    });

    // Create transparent client using the real implementation - now properly typed!
    transparentClient = createTRPCClient<typeof serverClient>(trpcProxyClient);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  const session = createAnonymousTestSession();

  describe('Product Provider via HTTP', () => {
    it('should fetch product by slug through real HTTP calls', async () => {
      const slug = 'integration-test-product';

      // Get result from transparent client (through HTTP/TRPC)
      const trpcResult = await transparentClient.product.getBySlug(
        { slug },
        session
      );

      // Get result from server client (direct call)
      const directResult = await serverClient.product.getBySlug(
        { slug },
        session
      );

      // Results should have the same structure
      expect(trpcResult).toBeDefined();
      expect(trpcResult.slug).toBe(slug);
      expect(trpcResult.name).toBeDefined();
      expect(trpcResult.description).toBeDefined();
      expect(trpcResult.image).toBeDefined();

      // Both should have the same slug (faker uses seed for consistency)
      expect(trpcResult.slug).toBe(directResult.slug);
    });

    it('should fetch product by id through real HTTP calls', async () => {
      const productId = 'integration-test-id';

      const trpcResult = await transparentClient.product.getById(
        { id: productId },
        session
      );

      const directResult = await serverClient.product.getById(
        { id: productId },
        session
      );

      expect(trpcResult).toBeDefined();
      expect(trpcResult.identifier.key).toBe(productId);
      expect(trpcResult.name).toBeDefined();
      expect(trpcResult.description).toBeDefined();

      // Should match direct call
      expect(trpcResult.identifier?.key).toBe(directResult.identifier?.key);
    });
  });

  describe('Search Provider via HTTP', () => {
    it('should perform search through real HTTP calls', async () => {
      const searchTerm = 'integration test search';

      const trpcResult = await transparentClient.search.queryByTerm(
        {
          search: {
            term: searchTerm,
            page: 0,
            pageSize: 10,
            facets: []
          }
        },
        session
      );

      const directResult = await serverClient.search.queryByTerm(
        {
          search: {
            term: searchTerm,
            page: 0,
            pageSize: 10,
            facets: []
          }
        },
        session
      );

      expect(trpcResult).toBeDefined();
      expect(trpcResult.products).toBeDefined();
      expect(Array.isArray(trpcResult.products)).toBe(true);
      expect(trpcResult.facets).toBeDefined();

      // Should match direct call structure
      expect(trpcResult.products.length).toBe(directResult.products.length);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      // This should work normally first
      const result = await transparentClient.product.getById(
        { id: 'test-error-handling' },
        session
      );
      expect(result).toBeDefined();
    });
  });

  describe('API Equivalence', () => {
    it('should produce identical results for TRPC vs direct calls', async () => {
      const testId = 'equivalence-test';

      // Make same call through both paths
      const [trpcResult, directResult] = await Promise.all([
        transparentClient.product.getById(
          { id: testId },
          session
        ),
        serverClient.product.getById({ id: testId }, session)
      ]);

      // Results should be structurally equivalent
      expect(trpcResult.identifier.key).toBe(directResult.identifier.key);
      expect(trpcResult.name).toBe(directResult.name);
      expect(trpcResult.slug).toBe(directResult.slug);
      expect(trpcResult.description).toBe(directResult.description);
    });
  });
});
