import {
  buildClient,
  NoOpCache,
  ProductQuerySchema,
  ProductSchema,
  ProductMutationSchema,
  Session,
  ProductQuery,
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

describe('extending provider models', () => {
  const ExtendedProductModel = ProductSchema.extend({
    gtin: z.string().default('gtin-default'),
  });
  type ExtendedProduct = z.infer<typeof ExtendedProductModel>;

  class ExtendedProductProvider extends FakeProductProvider<ExtendedProduct> {
    protected override async fetch(queries: ProductQuery[], session: Session) {
      const base = await super.fetch(queries, session);

      for (const b of base) {
        if (b.identifier.key === '1234') {
          b.gtin = 'gtin-1234';
        }
      }

      return base;
    }
  }

  function withExtendedCapabilities(capabilities: FakeCapabilities) {
    return (cache: Cache) => {
      const client = {} as Partial<{
        product: ExtendedProductProvider;
      }>;

      client.product = new ExtendedProductProvider(
        { jitter: { mean: 300, deviation: 100 } },
        ExtendedProductModel,
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
        url: 'http://localhost:3000',
      }),
    ],
  });

  const server = createHTTPServer({
    router: mergedRouter,
    createContext() {
      return {} as any;
    },
  });

  server.listen(3000);

  it('should get default properties for new model fields', async () => {
    const productWithDefaultGTIN = await trpc.product.query([
      {
        query: 'id',
        id: 'default',
      },
    ]);

    expect(productWithDefaultGTIN[0].gtin).toBe('gtin-default');
  });

  it('should deserialize fields according to the custom provider implementation', async () => {
    const productWithGTINInitialization = await trpc.product.query([
      {
        query: 'id',
        id: '1234',
      },
    ]);

    expect(productWithGTINInitialization[0].gtin).toBe('gtin-1234');
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });
});
