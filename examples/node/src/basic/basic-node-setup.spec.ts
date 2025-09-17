import { buildClient, NoOpCache, SessionSchema } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';

describe('basic node setup', () => {
  const client = buildClient(
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

  const session = SessionSchema.parse({
    id: '1234567890'
  });

  it('should only get back the enabled capabilities', async () => {
    expect(client.product).toBeDefined();
    expect(client.search).toBeDefined();
  });

  it('should be able to call the enabled capabilities', async () => {
    const product = await client.product.getBySlug({
        slug: '1234'
    }, session);

    expect(product).toBeDefined();
    expect(product.slug).toBe('1234');
  });
});
