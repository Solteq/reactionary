import { NoOpCache, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { withMagentoCapabilities } from '../core/initialize.js';
import { MagentoCapabilitiesSchema } from '../schema/capabilities.schema.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';

describe('Magento does not claim the taxonomy capability', () => {
  it('does not declare it in its capabilities', () => {
    expect(Object.keys(MagentoCapabilitiesSchema.shape)).not.toContain('taxonomy');
  });

  it('builds a client without taxonomy', () => {
    const config = MagentoConfigurationSchema.parse({ adminApiKey: 'key', baseUrl: 'https://magento.example.invalid', allCurrencies: [] });
    const client = withMagentoCapabilities(config, { product: { enabled: true } })(new NoOpCache(), createInitialRequestContext());

    expect(client.product).toBeDefined();
    expect('taxonomy' in client).toBe(false);
  });
});
