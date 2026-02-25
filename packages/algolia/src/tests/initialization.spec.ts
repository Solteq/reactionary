import { createInitialRequestContext } from '@reactionary/core';
import { initialize, type AlgoliaConfiguration } from '../index.js';

describe('algolia capability initialization', () => {
  const dummyConfig = {
    appId: '',
    apiKey: '',
    indexName: '',
  } satisfies AlgoliaConfiguration;

  const dummyContext = createInitialRequestContext();

  it('can initialize productSearch capability by default', () => {
    const withContext = initialize(dummyConfig);
    const client = withContext({ request: dummyContext });

    expect(client.productSearch).toBeDefined();
    expect(client.analytics).toBeDefined();
  });

  it('can initialize capabilities selectively', () => {
    const withContext = initialize(dummyConfig, {
      productSearch: true,
    });
    const client = withContext({ request: dummyContext });

    expect(client.productSearch).toBeDefined();
    expect('analytics' in client).toBe(false);
  });

  it('can initialize analytics capability selectively', () => {
    const withContext = initialize(dummyConfig, {
      analytics: true,
    });
    const client = withContext({ request: dummyContext });

    expect(client.analytics).toBeDefined();
    expect('productSearch' in client).toBe(false);
  });
});
