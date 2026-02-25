import { createInitialRequestContext } from '@reactionary/core';
import { initialize, type GoogleAnalyticsConfiguration } from '../index.js';

describe('google-analytics capability initialization', () => {
  const dummyConfig = {
    apiSecret: 'api-secret',
    measurementId: 'measurement-id',
    url: 'https://www.google-analytics.com/mp/collect',
  } satisfies GoogleAnalyticsConfiguration;

  const dummyContext = createInitialRequestContext();

  it('can initialize analytics capability by default', () => {
    const withContext = initialize(dummyConfig);
    const client = withContext({ request: dummyContext });

    expect(client.analytics).toBeDefined();
  });

  it('can initialize analytics capability selectively', () => {
    const withContext = initialize(dummyConfig, {
      analytics: true,
    });
    const client = withContext({ request: dummyContext });

    expect(client.analytics).toBeDefined();
  });
});
