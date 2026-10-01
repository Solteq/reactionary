import { describe, expect, it } from 'vitest';
import {
  MemoryCache,
  NoOpCache,
} from '@reactionary/core';
import { createReactionaryFeedClientFromEnv } from './env-client-builder.js';

describe('createReactionaryFeedClientFromEnv', () => {
  it('enables only feed and sitemap capabilities for full commerce providers', () => {
    const { client } = createReactionaryFeedClientFromEnv({
      env: {
        ENABLED_COMMERCETOOLS: 'true',
      },
      loadEnv: false,
    });

    expect(providerCapabilityKeys(client)).toEqual([
      'category',
      'inventory',
      'price',
      'product',
      'productReviews',
      'productSearch',
      'store',
    ]);
  });

  it('enables only product search for search providers', () => {
    const { client } = createReactionaryFeedClientFromEnv({
      env: {
        ENABLED_ALGOLIA: 'true',
      },
      loadEnv: false,
    });

    expect(providerCapabilityKeys(client)).toEqual(['productSearch']);
  });

  it('does not enable non-feed capabilities for auxiliary providers', () => {
    const { client } = createReactionaryFeedClientFromEnv({
      env: {
        ENABLED_UNOMI: 'true',
      },
      loadEnv: false,
    });

    expect(providerCapabilityKeys(client)).toEqual([]);
  });

  it('uses MemoryCache by default', () => {
    const { client } = createReactionaryFeedClientFromEnv({
      env: {
        ENABLED_FAKE: 'true',
      },
      loadEnv: false,
    });

    expect(client.cache).toBeInstanceOf(MemoryCache);
  });

  it('uses an explicit cache override when provided', () => {
    const cache = new NoOpCache();
    const { client } = createReactionaryFeedClientFromEnv({
      env: {
        ENABLED_FAKE: 'true',
      },
      cache,
      loadEnv: false,
    });

    expect(client.cache).toBe(cache);
  });
});

function providerCapabilityKeys(client: object): string[] {
  return Object.keys(client)
    .filter((key) => !['analytics', 'cache', 'productRecommendations'].includes(key))
    .sort();
}
