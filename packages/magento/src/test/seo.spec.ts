import { describe, expect, it } from 'vitest';
import { parseMagentoSeo } from '../utils/seo.js';

describe('parseMagentoSeo', () => {
  it('maps authored meta title and description from custom attributes', () => {
    expect(
      parseMagentoSeo({
        custom_attributes: [
          { attribute_code: 'url_key', value: 'coffee-maker' },
          { attribute_code: 'meta_title', value: 'Buy a coffee maker' },
          { attribute_code: 'meta_description', value: 'Fast and quiet.' },
        ],
      }),
    ).toEqual({ title: 'Buy a coffee maker', description: 'Fast and quiet.' });
  });

  it('returns undefined when neither is authored', () => {
    expect(parseMagentoSeo({})).toBeUndefined();
    expect(parseMagentoSeo({ custom_attributes: [{ attribute_code: 'url_key', value: 'x' }] })).toBeUndefined();
  });

  it('treats blank and null values as not authored', () => {
    expect(
      parseMagentoSeo({
        custom_attributes: [
          { attribute_code: 'meta_title', value: '   ' },
          { attribute_code: 'meta_description', value: null },
        ],
      }),
    ).toBeUndefined();
  });
});
