import { RequestContext, Session } from '@reactionary/core';
import { FakeConfiguration } from '../schema/configuration.schema';

export function getFakerTestConfiguration(): FakeConfiguration {
  return {
    jitter: {
      mean: 0,
      deviation: 0,
    },
    seeds: {
      product: 1,
      search: 1,
      category: 1,
    },
  };
}

