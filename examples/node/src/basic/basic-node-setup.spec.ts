import 'dotenv/config';
import {
  ClientBuilder,
  createInitialRequestContext,
  NoOpCache,
  type Client,
  type RequestContext,
} from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('basic node setup', () => {
  let client: Partial<Client>;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    client = new ClientBuilder(reqCtx)
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
          { productSearch: true, product: true, identity: false }
        )
      )
      .withCache(new NoOpCache())
      .build();
  });

  it('should only get back the enabled capabilities', async () => {
    expect(client.product).toBeDefined();
    expect(client.productSearch).toBeDefined();
  });

  it('should be able to call the enabled capabilities', async () => {
    const product = await client.product!.getBySlug(
      {
        slug: '1234',
      }
    );

    expect(product).toBeDefined();
    expect(product!.slug).toBe('1234');
  });
});
