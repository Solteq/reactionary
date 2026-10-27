import { createInitialRequestContext, ProductSchema } from '@reactionary/core';
import type { RequestContext } from '@reactionary/core';
import type { StoreProduct } from '@medusajs/types';
import { describe, expect, it } from 'vitest';
import { MedusaProductFactory } from '../factories/product/product.factory.js';
import { parseAttributeDefinitions, parseFlags } from '../utils/taxonomy.js';

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

  it('maps tags to terms, preferring the metadata names over the tag value', () => {
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


  it('names a term from the metadata for the request locale even when the value is English', () => {
    const tags = [
      {
        id: 'ptag_1',
        value: 'Cordless',
        external_id: 'features/cordless',
        created_at: '',
        updated_at: '',
        metadata: { vocabulary: 'features', names: { en: 'Cordless', da: 'Traadloes' } },
      },
    ];

    const da = factory.parseProduct(createContext('da-DK'), createProduct({ tags }));
    const en = factory.parseProduct(createContext('en-US'), createProduct({ tags }));
    const fr = factory.parseProduct(createContext('fr-FR'), createProduct({ tags }));

    expect(da.terms[0].name).toBe('Traadloes');
    expect(en.terms[0].name).toBe('Cordless');
    // no french name, so en wins over the value
    expect(fr.terms[0].name).toBe('Cordless');
  });

  it('falls back to the value when the metadata names have neither the locale nor en', () => {
    const product = factory.parseProduct(
      createContext('fr-FR'),
      createProduct({
        tags: [
          {
            id: 'ptag_1',
            value: 'Kabellos',
            external_id: 'features/cordless',
            created_at: '',
            updated_at: '',
            metadata: { names: { de: 'Drahtlos' } },
          },
        ],
      }),
    );

    expect(product.terms[0].name).toBe('Kabellos');
  });

  it('names the product type from the metadata, then the value', () => {
    const withNames = factory.parseProduct(
      createContext('da-DK'),
      createProduct({ type: { ...productType, metadata: { ...productType.metadata, names: { en: 'Drills', da: 'Boremaskiner' } } } }),
    );
    const withoutNames = factory.parseProduct(createContext('da-DK'), createProduct({ type: productType }));

    expect(withNames.productType?.name).toBe('Boremaskiner');
    expect(withoutNames.productType?.name).toBe('Drills');
  });
});

describe('parseAttributeDefinitions', () => {
  it('accepts null maps and a null data type from the producer', () => {
    const definitions = parseAttributeDefinitions([
      { key: 'k1', names: null, groups: null, unit: null, order: 3, data_type: null },
    ]);

    expect(definitions.get('k1')).toMatchObject({ key: 'k1', names: {}, groups: {}, unit: {}, order: 3, data_type: undefined });
  });

  it('coerces a numeric string order and defaults a missing or invalid one to 0', () => {
    const definitions = parseAttributeDefinitions([
      { key: 'a', order: '12' },
      { key: 'b', order: 'abc' },
      { key: 'c' },
      { key: 'd', order: null },
    ]);

    expect([...definitions.values()].map((d) => d.order)).toEqual([12, 0, 0, 0]);
  });

  it('accepts a plain string unit as the unit for every locale', () => {
    const factory = new MedusaProductFactory(ProductSchema);
    const product = factory.parseProduct(
      createContext('da-DK'),
      createProduct({
        type: { ...productType, metadata: { attribute_definitions: [{ key: 'w', names: { en: 'Weight' }, unit: 'kg' }] } },
        metadata: { w: '3' },
      }),
    );

    expect(product.sharedAttributes[0]).toMatchObject({ name: 'Weight', unit: 'kg' });
  });

  it('skips only the malformed definitions of a mixed array', () => {
    const definitions = parseAttributeDefinitions([
      { key: 'good', names: { en: 'Good' } },
      'garbage',
      42,
      null,
      { names: { en: 'No key' } },
      { key: 'badnames', names: 'text' },
      { key: 'also-good', order: '2' },
    ]);

    expect([...definitions.keys()]).toEqual(['good', 'also-good']);
  });
});
