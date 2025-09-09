import {
  ClientBuilder,
  Cache,
  NoOpCache,
  ProductMutationSchema,
  ProductQuery,
  ProductQuerySchema,
  ProductSchema,
  Session,
  SessionSchema,
} from '@reactionary/core';
import {
  FakeProductProvider,
  withFakeCapabilities,
} from '@reactionary/provider-fake';
import z from 'zod';

describe('basic node provider extension (models)', () => {
  const session = SessionSchema.parse({
    id: '1234567890',
  });

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

  function withExtendedCapabilities() {
    return (cache: Cache) => {
      const client = {
        product: new ExtendedProductProvider(
          { jitter: { mean: 0, deviation: 0 } },
          ExtendedProductModel,
          ProductQuerySchema,
          ProductMutationSchema,
          cache
        ),
      };

      return client;
    };
  }

  const client = new ClientBuilder()
    .withCapability(
      withFakeCapabilities(
        {
          jitter: {
            mean: 0,
            deviation: 0,
          },
        },
        { search: true, product: false, identity: false }
      )
    )
    .withCapability(withExtendedCapabilities())
    .withCache(new NoOpCache())
    .build();

  it('should get the enabled set of capabilities across providers', async () => {
    expect(client.product).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.identity).toBeUndefined();
  });

  it('should be able to call the regular methods and get the default value', async () => {
    const products = await client.product.query(
      [
        {
          query: 'slug',
          slug: '1234',
        },
      ],
      session
    );

    expect(products.length).toBe(1);
    expect(products[0].gtin).toBe('gtin-default');
  });

  it('should be able to get serialized value from the extended provider', async () => {
    const products = await client.product.query(
      [
        {
          query: 'id',
          id: '1234',
        },
      ],
      session
    );

    expect(products.length).toBe(1);
    expect(products[0].gtin).toBe('gtin-1234');
  });
});
