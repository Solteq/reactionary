import { describe, expect, it } from 'vitest';
import { ProductSchema } from '../schemas/models/product.model.js';
import { ProductSearchResultItemSchema } from '../schemas/models/product-search.model.js';

const baseVariant = {
  identifier: { sku: 'sku-1' },
  name: 'Variant',
  images: [],
  ean: '',
  gtin: '',
  upc: '',
  barcode: '',
  options: [],
};

const baseProduct = {
  identifier: { key: 'product-1' },
  name: 'Product',
  slug: 'product',
  description: '',
  longDescription: '',
  brand: '',
  manufacturer: '',
  parentCategories: [],
  published: true,
  sharedAttributes: [],
  options: [],
  mainVariant: baseVariant,
};

describe('ProductSchema taxonomy fields', () => {
  it('defaults terms and flags and leaves productType undefined', () => {
    const product = ProductSchema.parse(baseProduct);

    expect(product.terms).toEqual([]);
    expect(product.flags).toEqual([]);
    expect(product.productType).toBeUndefined();
  });

  it('keeps product type, terms and attribute unit', () => {
    const product = ProductSchema.parse({
      ...baseProduct,
      productType: { identifier: { key: 'icecat-cat-8862' }, name: 'Drill' },
      terms: [{ identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless', parent: { key: 'features/power' } }],
      flags: ['ageRestricted'],
      sharedAttributes: [{ identifier: { key: 'weight' }, group: 'General', name: 'Weight', unit: 'kg', dataType: 'numeric', values: [] }],
    });

    expect(product.productType?.name).toBe('Drill');
    expect(product.terms[0].parent?.key).toBe('features/power');
    expect(product.flags).toEqual(['ageRestricted']);
    expect(product.sharedAttributes[0].unit).toBe('kg');
    expect(product.sharedAttributes[0].dataType).toBe('numeric');
  });
});

describe('ProductSearchResultItemSchema taxonomy fields', () => {
  it('accepts items without product type and terms', () => {
    const item = ProductSearchResultItemSchema.parse({
      identifier: { key: 'p1' },
      name: 'P',
      slug: 'p',
      variants: [],
    });

    expect(item.productType).toBeUndefined();
    expect(item.terms).toBeUndefined();
  });

  it('accepts product type and terms', () => {
    const item = ProductSearchResultItemSchema.parse({
      identifier: { key: 'p1' },
      name: 'P',
      slug: 'p',
      variants: [],
      productType: { identifier: { key: 't1' }, name: 'Type' },
      terms: [{ identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Cordless' }],
    });

    expect(item.productType?.identifier.key).toBe('t1');
    expect(item.terms).toHaveLength(1);
  });
});
