import {
  buildClient,
  NoOpCache,
  ProductQuerySchema,
  ProductSchema,
  ProductMutationSchema,
  Session,
  ProductQuery,
  BaseQuerySchema,
  ProductMutation,
  Product,
} from '@reactionary/core';
import {
  FakeCapabilities,
  FakeProductProvider,
  withFakeCapabilities,
} from '@reactionary/provider-fake';
import { createTRPCRouter } from '@reactionary/trpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';
import { Cache } from '@reactionary/core';

describe('extending provider queries', () => {
  const ProductQueryByCustomFieldSchema = BaseQuerySchema.extend({
    query: z.literal('custom'),
    custom: z.string()
  });
  type ProductQueryByCustomField = z.infer<typeof ProductQueryByCustomFieldSchema>;

  class ExtendedProviderProvider extends FakeProductProvider<Product, ProductQuery | ProductQueryByCustomField, ProductMutation> {
    protected override async fetch(queries: ProductQuery[], session: Session) {
      const base = await super.fetch(queries, session);

      return base;
    }
  }

  function withExtendedCapabilities(capabilities: FakeCapabilities) {
    return (cache: Cache) => {
      const client = {} as Partial<{
        product: ExtendedProviderProvider;
      }>;

      client.product = new ExtendedProviderProvider(
        { jitter: { mean: 300, deviation: 100 } },
        ProductSchema,
        ProductQuerySchema,
        ProductMutationSchema,
        cache
      );

      return client;
    };
  }

  const client = buildClient(
    [
      withFakeCapabilities(
        {
          jitter: {
            mean: 300,
            deviation: 100,
          },
        },
        { search: true, product: false, identity: false }
      ),
      withExtendedCapabilities({ product: true }),
    ],
    {
      cache: new NoOpCache(),
    }
  );

  const mergedRouter = createTRPCRouter(client);

  const trpc = createTRPCClient<typeof mergedRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:3002',
      }),
    ],
  });

  const server = createHTTPServer({
    router: mergedRouter,
    createContext() {
      return {} as any;
    },
  });

  server.listen(3002);

  it('should be able to call the custom query', async () => {
    // TODO: Implement me
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });
});
