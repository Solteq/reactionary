import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { withHclCapabilities } from '../core/initialize.js';
import { HclCapabilitiesSchema } from '../schema/capabilities.schema.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';

describe('HCL does not claim the taxonomy capability', () => {
  it('does not declare it in its capabilities', () => {
    expect(Object.keys(HclCapabilitiesSchema.shape)).not.toContain('taxonomy');
  });

  it('builds a client without taxonomy', () => {
    const config = HclConfigurationSchema.parse({ apiUrl: 'https://hcl.example.invalid', storeId: '1' });
    const client = withHclCapabilities(config, { product: { enabled: true } })(new NoOpCache(), createInitialRequestContext());

    expect(client.product).toBeDefined();
    expect('taxonomy' in client).toBe(false);
  });
});
