import { createInitialRequestContext, ProductSchema } from '@reactionary/core';
import type { RequestContext } from '@reactionary/core';
import type { StoreProduct } from '@medusajs/types';
import { describe, expect, it } from 'vitest';
import { MedusaProductFactory } from '../factories/product/product.factory.js';
import { parseFlags } from '../utils/taxonomy.js';

const definitions = [
  {
    key: 'icecat-feature-2',
    names: { en: 'Battery voltage', da: 'Batterispaending' },
    groups: { en: 'Power', da: 'Stroem' },
    unit: { en: 'V' },
    order: 20,
    data_type: 'numeric',
  },
  {
    key: 'icecat-feature-1',
    names: { en: 'Weight', da: 'Vaegt' },
    groups: { en: 'General' },
    unit: { en: 'kg' },
    order: 10,
    data_type: 'numeric',
  },
];

function createProduct(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: 'prod_1',
    title: 'Drill',
    handle: 'drill',
    subtitle: null,
    description: null,
    is_giftcard: false,
    status: 'published',
    thumbnail: null,
    width: null,
    weight: null,
    length: null,
    height: null,
    origin_country: null,
    hs_code: null,
    mid_code: null,
    material: null,
    collection_id: null,
    type_id: null,
    discountable: true,
    external_id: 'drill-1',
    created_at: null,
    updated_at: null,
    deleted_at: null,
    variants: [{ id: 'var_1', title: 'Drill', sku: 'sku-1' } as NonNullable<StoreProduct['variants']>[number]],
    options: [],
    images: [],
    ...overrides,
  };
}

function createContext(locale: string): RequestContext {
  const context = createInitialRequestContext();
  context.languageContext.locale = locale;
  return context;
}

const productType = {
  id: 'ptyp_1',
  value: 'Drills',
  external_id: 'icecat-cat-8862',
  created_at: '',
  updated_at: '',
  metadata: { attribute_definitions: definitions },
};

describe('Medusa product factory taxonomy mapping', () => {
  const factory = new MedusaProductFactory(ProductSchema);

  it('keeps raw metadata keys when the product has no type', () => {
    const product = factory.parseProduct(
      createContext('en-US'),
      createProduct({ metadata: { 'Battery voltage': '18' } }),
    );

    expect(product.sharedAttributes.map((a) => [a.identifier.key, a.name, a.group])).toEqual([
      ['Battery voltage', 'Battery voltage', ''],
    ]);
    expect(product.productType).toBeUndefined();
    expect(product.terms).toEqual([]);
    expect(product.flags).toEqual([]);
  });

  it('labels attributes from the definitions, fills group and unit and orders by definition order', () => {
    const product = factory.parseProduct(
      createContext('da-DK'),
      createProduct({
        weight: 3,
        type: productType,
        metadata: {
          'icecat-feature-2': '18',
          'icecat-feature-1': '1.5',
          legacy_key: 'legacy',
          flags: 'ageRestricted',
          reactionaryaccessories: 'a;b',
          compliance_data_ce_marking: 'true',
        },
      }),
    );

    expect(
      product.sharedAttributes.map((a) => [a.identifier.key, a.name, a.group, a.unit, a.dataType]),
    ).toEqual([
      ['weight', 'Weight', '', undefined, undefined],
      ['icecat-feature-1', 'Vaegt', 'General', 'kg', 'numeric'],
      ['icecat-feature-2', 'Batterispaending', 'Stroem', 'V', 'numeric'],
      ['legacy_key', 'legacy_key', '', undefined, undefined],
    ]);
    expect(product.productType).toEqual({ identifier: { key: 'icecat-cat-8862' }, name: 'Drills' });
  });

  it('falls back to en for locales without a label', () => {
    const product = factory.parseProduct(
      createContext('fr-FR'),
      createProduct({ type: productType, metadata: { 'icecat-feature-1': '1.5' } }),
    );

    expect(product.sharedAttributes[0].name).toBe('Weight');
  });

  it('falls back to any label and then to the raw key', () => {
    const product = factory.parseProduct(
      createContext('en-US'),
      createProduct({
        type: {
          ...productType,
          metadata: {
            attribute_definitions: [
              { key: 'k1', names: { de: 'Gewicht' }, order: 1 },
              { key: 'k2', names: {}, order: 2 },
            ],
          },
        },
        metadata: { k1: 'x', k2: 'y' },
      }),
    );

    expect(product.sharedAttributes.map((a) => a.name)).toEqual(['Gewicht', 'k2']);
  });

  it('accepts attribute definitions encoded as a JSON string', () => {
    const product = factory.parseProduct(
      createContext('en-US'),
      createProduct({
        type: { ...productType, metadata: { attribute_definitions: JSON.stringify(definitions) } },
        metadata: { 'icecat-feature-1': '1.5' },
      }),
    );

    expect(product.sharedAttributes[0].name).toBe('Weight');
    expect(product.sharedAttributes[0].unit).toBe('kg');
  });

  it('ignores malformed attribute definitions', () => {
    const product = factory.parseProduct(
      createContext('en-US'),
      createProduct({
        type: { ...productType, metadata: { attribute_definitions: 'not json' } },
        metadata: { 'icecat-feature-1': '1.5' },
      }),
    );

    expect(product.sharedAttributes[0].name).toBe('icecat-feature-1');
  });

  it('maps tags to terms using the translated tag value as the name', () => {
    const product = factory.parseProduct(
      createContext('da-DK'),
      createProduct({
        tags: [
          {
            id: 'ptag_1',
            value: 'Traadloes',
            external_id: 'features/cordless',
            created_at: '',
            updated_at: '',
            metadata: {
              term_id: 'features/cordless',
              vocabulary: 'features',
              names: { en: 'Cordless', da: 'Traadloes' },
              parent: 'features/power',
            },
          },
          {
            id: 'ptag_2',
            value: '',
            external_id: null,
            created_at: '',
            updated_at: '',
            metadata: { term_id: 'features/outdoor-rated', names: { en: 'Outdoor rated' } },
          },
          { id: 'ptag_3', value: 'Plain tag', created_at: '', updated_at: '' },
        ],
      }),
    );

    expect(product.terms).toEqual([
      {
        identifier: { key: 'features/cordless' },
        vocabulary: 'features',
        name: 'Traadloes',
        parent: { key: 'features/power' },
      },
      {
        identifier: { key: 'features/outdoor-rated' },
        vocabulary: 'features',
        name: 'Outdoor rated',
      },
    ]);
  });

  it('falls back to the id slug when a tag has neither a value nor localized names', () => {
    const product = factory.parseProduct(
      createContext('en-US'),
      createProduct({
        tags: [{ id: 'ptag_1', value: '', external_id: 'features/cordless', created_at: '', updated_at: '' }],
      }),
    );

    expect(product.terms[0]).toMatchObject({ name: 'cordless', vocabulary: 'features' });
  });

  it('maps flags and drops unknown ones', () => {
    const product = factory.parseProduct(
      createContext('en-US'),
      createProduct({ metadata: { flags: 'ageRestricted, discontinued,bogus,' } }),
    );

    expect(product.flags).toEqual(['ageRestricted', 'discontinued']);
  });

  it('parseFlags tolerates missing and non-string values', () => {
    expect(parseFlags(undefined)).toEqual([]);
    expect(parseFlags(42)).toEqual([]);
    expect(parseFlags('professionalUseOnly,professionalUseOnly')).toEqual(['professionalUseOnly']);
  });
});
