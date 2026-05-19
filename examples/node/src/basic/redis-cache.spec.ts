import { RedisCache, ProductSchema, ClientBuilder, NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/fake';

describe('redis cache interactions', () => {
  it('should be able to get and put', async () => {
        const reqCtx = createInitialRequestContext();
        const client = new ClientBuilder(reqCtx)
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
                  search: 1,
                },
              },
              { product: { enabled: true } }
            )
          )
          .withCache(new NoOpCache())
          .build();

    const cache = new RedisCache();
    const result = await client.product.getById({ identifier: { key: 'P1000' } });
    
    if (!result.success) {
      throw new Error('Failed to get product');
    }

    const product = result.value;
    const cacheKey = result.meta.cache.key;

    await cache.put(cacheKey, product, { dependencyIds: [cacheKey], ttlSeconds: 60 });

    const cached = await cache.get(cacheKey, ProductSchema);

    expect(cached).toBeDefined();
    expect(cached?.identifier.key).toEqual('P1000');

    await cache.invalidate([cacheKey]);

    const cachedAfterInvalidation = await cache.get(cacheKey, ProductSchema);

    expect(cachedAfterInvalidation).toBeNull();
  });
});
