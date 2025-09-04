import { buildClient, NoOpCache, ProductQuerySchema, ProductSchema, ProductMutationSchema, Client } from '@reactionary/core';
import { FakeCapabilities, FakeProductProvider, withFakeCapabilities } from '@reactionary/provider-fake';
import { createTRPCRouter } from '@reactionary/trpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';
import { Cache } from '@reactionary/core';

describe('provider extension', () => {
  let server: any;

  it('should be able to extend a provider with a custom model schema', async () => {
    const ExtendedProductModel = ProductSchema.extend({
      gtin: z.string().default('placeholder')
    });
    type ExtendedProduct = z.infer<typeof ExtendedProductModel>;
    
    class ExtendedProviderProvider extends FakeProductProvider<ExtendedProduct> {

    }

    function withExtendedCapabilities(capabilities: FakeCapabilities) {
        return (cache: Cache) => {
            const client = {} as Partial<{
              product: ExtendedProviderProvider
            }>;
    
            client.product = new ExtendedProviderProvider({ jitter: { mean: 300, deviation: 100} }, ExtendedProductModel, ProductQuerySchema, ProductMutationSchema, cache)
    
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

    type RouterType = typeof mergedRouter;

    server = createHTTPServer({
      router: mergedRouter,
      createContext() {
        return {} as any;
      },
    });

    server.listen(3000);

    const trpc = createTRPCClient<RouterType>({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000',
        }),
      ],
    });

    const product = await trpc.product.query([
      {
        query: 'id',
        id: '1234',
      },
    ]);

    expect((product[0]).gtin).toBe('placeholder');
  });

  afterEach((done) => {
    server.close(() => {
      done();
    });
  });
});
