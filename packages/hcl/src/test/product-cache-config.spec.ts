import { REACTIONARY_ENTRYPOINT_METADATA } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { HclProductCapability } from '../capabilities/product.capability.js';

/**
 * The HCL client adds `langId` to every request, so anything cached from these lookups
 * holds localized text and has to be keyed by locale.
 */
describe('HCL product capability cache configuration', () => {
  const methods = ['getById', 'getBySlug', 'getBySKU'] as const;

  it.each(methods)('%s is cached per locale', (methodName) => {
    const metadata = HclProductCapability.prototype[methodName][REACTIONARY_ENTRYPOINT_METADATA];

    expect(metadata?.cache).toBe(true);
    expect(metadata?.localeDependentCaching).toBe(true);
  });
});
