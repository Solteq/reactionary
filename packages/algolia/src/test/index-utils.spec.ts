import { describe, expect, it } from 'vitest';
import { AlgoliaConfigurationSchema } from '../schema/configuration.schema.js';
import { getProductIndexNameForLocale } from '../core/index-utils.js';

const baseConfig = { appId: 'app', apiKey: 'key', indexName: 'products' };

describe('getProductIndexNameForLocale', () => {
  it('suffixes English by default', () => {
    const config = AlgoliaConfigurationSchema.parse(baseConfig);
    expect(config.useBaseIndexNameForEnglishLocale).toBe(false);
    expect(getProductIndexNameForLocale('products', 'en-US', config)).toBe('products_en');
    expect(getProductIndexNameForLocale('products', 'da-DK', config)).toBe('products_da');
  });

  it('uses the base index for English only when the legacy flag is enabled', () => {
    const config = AlgoliaConfigurationSchema.parse({ ...baseConfig, useBaseIndexNameForEnglishLocale: true });
    expect(getProductIndexNameForLocale('products', 'en-US', config)).toBe('products');
    expect(getProductIndexNameForLocale('products', 'da-DK', config)).toBe('products_da');
  });
});
