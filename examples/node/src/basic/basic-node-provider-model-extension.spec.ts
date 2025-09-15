import {
  ClientBuilder,
  Cache,
  NoOpCache,
  ProductSchema,
  SessionSchema,
  ProductQueryById,
  ProductQueryBySlug,
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
    protected override parseSingle(body: ProductQueryById | ProductQueryBySlug): ExtendedProduct {
      const model = super.parseSingle(body);

      if (body.id) {
        model.gtin = 'gtin-1234';
      }

      return this.assert(model);
    }
  }

  function withExtendedCapabilities() {
    return (cache: Cache) => {
      const client = {
        product: new ExtendedProductProvider(
          { jitter: { mean: 0, deviation: 0 } },
          ExtendedProductModel,
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
    const product = await client.product.getBySlug(
      {
        slug: '1234',
      },
      session
    );

    expect(product).toBeDefined();
    expect(product.gtin).toBe('gtin-default');
  });

  it('should be able to get serialized value from the extended provider', async () => {
    const product = await client.product.getById(
      {
        id: '1234',
      },
      session
    );

    expect(product).toBeDefined();
    expect(product.gtin).toBe('gtin-1234');
  });
});
