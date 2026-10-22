import { ClientBuilder, NoOpCache, RecordingAnalyticsSubscriber, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { FakeAnalyticsCapability } from '../capabilities/analytics.capability.js';
import { getFakerTestConfiguration } from './test-utils.js';

describe('Fake Analytics Capability', () => {
  it('is a valid subscriber that ignores every event without affecting other subscribers', async () => {
    const context = createInitialRequestContext();
    const recorder = new RecordingAnalyticsSubscriber();
    const fake = new FakeAnalyticsCapability(getFakerTestConfiguration(), new NoOpCache(), context);
    const client = new ClientBuilder(context)
      .withCapability(() => ({ analytics: fake }))
      .withAnalyticsSubscriber(recorder)
      .build();

    const result = await client.analytics.productViewed({ product: { key: 'p1' } });
    await client.analytics.flush();

    expect(result.success).toBe(true);
    expect(await fake.handle()).toBe('ignored');
    expect(recorder.events).toHaveLength(1);
  });
});
