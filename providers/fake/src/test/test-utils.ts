import type { FakeConfiguration } from '../schema/configuration.schema.js';

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

