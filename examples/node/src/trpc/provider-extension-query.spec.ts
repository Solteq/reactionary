import {
  buildClient,
  NoOpCache,
  ProductQuerySchema,
  ProductSchema,
  ProductMutationSchema,
  Session,
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

xdescribe('extending provider queries', () => {
  const ProductQueryByCustomFieldSchema = BaseQuerySchema.extend({
    query: z.string('custom'),
    custom: z.string()
  });
  type ProductQueryByCustomField = z.infer<typeof ProductQueryByCustomFieldSchema>;
  const ProductQueryExtendedSchema = z.union([...ProductQuerySchema.options, ProductQueryByCustomFieldSchema]);
  type ProductQueryExtended = z.infer<typeof ProductQueryExtendedSchema>;

  class ExtendedProviderProvider extends FakeProductProvider<Product, ProductQueryExtended, ProductMutation> {
    protected override async fetch(queries: ProductQueryExtended[], session: Session) {
      const base = await super.fetch(queries, session);

      for (let i = 0; i < queries.length; i++) {

        const query = queries[i];
        if (query.query === 'custom') {
          base[i].identifier.key = 'custom-' + query.custom;
        }
      }

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
        ProductQueryExtendedSchema,
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
    const product = await trpc.product.query([{
      query: 'custom',
      custom: '1234'
    }]);

    expect(product[0].identifier.key).toBe('custom-1234');
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });
});
