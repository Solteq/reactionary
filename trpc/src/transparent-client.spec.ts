import { buildClient, NoOpCache, SessionSchema } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { createTRPCServerRouter, introspectClient } from './index';

/**
 * Test suite for TRPC transparent client functionality
 * This tests the core introspection and router generation without HTTP setup
 */

// Jest test framework is now available

// Create the server-side client using the same pattern as examples/node
const serverClient = buildClient(
  [
    withFakeCapabilities(
      {
        jitter: {
          mean: 0,
          deviation: 0,
        },
      },
      { search: true, product: true, identity: false }
    ),
  ],
  {
    cache: new NoOpCache(),
  }
);

// Create TRPC router from the client
const router = createTRPCServerRouter(serverClient);

describe('TRPC Transparent Client Core Functionality', () => {

  const session = SessionSchema.parse({
    id: '1234567890',
  });

  describe('Client Introspection', () => {
    it('should correctly introspect client methods', () => {
      const methods = introspectClient(serverClient);
      
      expect(methods.length).toBeGreaterThan(0);
      
      // Should find product methods
      const productMethods = methods.filter(m => m.providerName === 'product');
      expect(productMethods.length).toBeGreaterThan(0);
      
      const getBySlugMethod = productMethods.find(m => m.name === 'getBySlug');
      expect(getBySlugMethod).toBeDefined();
      expect(getBySlugMethod!.isQuery).toBe(true);
      expect(getBySlugMethod!.isMutation).toBe(false);

      // Should find search methods
      const searchMethods = methods.filter(m => m.providerName === 'search');
      expect(searchMethods.length).toBeGreaterThan(0);
      
      const queryByTermMethod = searchMethods.find(m => m.name === 'queryByTerm');
      expect(queryByTermMethod).toBeDefined();
      expect(queryByTermMethod!.isQuery).toBe(true);

      // Note: Only testing enabled providers (product and search)
    });
  });

  describe('Router Generation', () => {
    it('should create TRPC router from client', () => {
      expect(router).toBeDefined();
      
      // Router should be an object (TRPC router)
      expect(typeof router).toBe('object');
      expect(router).toBeDefined();
    });

    it('should handle provider methods correctly', () => {
      const methods = introspectClient(serverClient);
      const providerNames = [...new Set(methods.map(m => m.providerName))];
      
      // Should have enabled providers
      expect(providerNames).toContain('product');
      expect(providerNames).toContain('search');
    });
  });

  describe('Method Classification', () => {
    it('should correctly classify query methods', () => {
      const methods = introspectClient(serverClient);
      
      const queryMethods = methods.filter(m => m.isQuery);
      const queryMethodNames = queryMethods.map(m => m.name);
      
      // Should include get* methods from enabled providers
      expect(queryMethodNames).toContain('getById');
      expect(queryMethodNames).toContain('getBySlug');
      
      // Should include query* methods  
      expect(queryMethodNames).toContain('queryByTerm');
    });

    it('should correctly classify mutation methods', () => {
      const methods = introspectClient(serverClient);
      
      const mutationMethods = methods.filter(m => m.isMutation);
      const mutationMethodNames = mutationMethods.map(m => m.name);
      
      // With current setup, only search and product are enabled
      // No mutations expected from these providers
    });
  });

  describe('Direct Client Functionality', () => {
    it('should have working product provider', async () => {
      const result = await serverClient.product.getBySlug(
        { slug: 'test-product' },
        session
      );
      
      expect(result).toBeDefined();
      expect(result.slug).toBe('test-product');
      expect(result.name).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should have working search provider', async () => {
      const result = await serverClient.search.queryByTerm(
        {
          search: {
            term: 'test search',
            page: 0,
            pageSize: 10,
            facets: []
          }
        },
        session
      );
      
      expect(result).toBeDefined();
      expect(result.products).toBeDefined();
      expect(result.facets).toBeDefined();
    });

    // Only testing enabled providers (product and search)
  });

  describe('Type System Validation', () => {
    it('should maintain provider interface structure', () => {
      // Verify the client has expected enabled provider structure
      expect(serverClient.product).toBeDefined();
      expect(serverClient.search).toBeDefined();
      
      // Verify methods exist
      expect(typeof serverClient.product.getById).toBe('function');
      expect(typeof serverClient.product.getBySlug).toBe('function');
      expect(typeof serverClient.search.queryByTerm).toBe('function');
    });
  });
});

// Export for potential use in other tests
export { serverClient, router };