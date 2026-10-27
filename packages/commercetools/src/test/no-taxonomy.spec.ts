import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { withCommercetoolsCapabilities } from '../core/initialize.js';
import { CommercetoolsCapabilitiesSchema } from '../schema/capabilities.schema.js';
import { getCommercetoolsTestConfiguration } from './test-utils.js';

describe('Commercetools does not claim the taxonomy capability', () => {
  it('does not declare it in its capabilities', () => {
    expect(Object.keys(CommercetoolsCapabilitiesSchema.shape)).not.toContain('taxonomy');
  });

  it('builds a client without taxonomy', () => {
    const client = withCommercetoolsCapabilities(getCommercetoolsTestConfiguration(), { product: { enabled: true } })(
      new NoOpCache(),
      createInitialRequestContext(),
    );

    expect(client.product).toBeDefined();
    expect('taxonomy' in client).toBe(false);
  });
});
