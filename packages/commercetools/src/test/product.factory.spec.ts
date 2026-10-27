import { assert, describe, expect, it } from 'vitest';
import type { ProductProjection, ProductType, Attribute } from '@commercetools/platform-sdk';
import { createInitialRequestContext, MemoryCache, ProductSchema } from '@reactionary/core';
import { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { CommercetoolsProductCapability } from '../capabilities/product.capability.js';
import { CommercetoolsAPI } from '../core/client.js';
import { useCommercetoolsFixtures } from './fixture-fetch.js';

const productType: ProductType = {
  id: 'pt-1',
  version: 1,
  key: 'rc-icecat-cat-8862',
  name: 'Drills',
  description: '',
  attributes: [
    {
      name: 'icecat-feature-1765',
      label: { en: 'Battery voltage', da: 'Batterispaending' },
      level: 'Product',
      isRequired: false,
      attributeConstraint: 'SameForAll',
      inputHint: 'SingleLine',
      isSearchable: false,
      type: { name: 'set', elementType: { name: 'ltext' } },
    },
    {
      name: 'colour',
      label: { en: 'Colour' },
      level: 'Product',
      isRequired: false,
      attributeConstraint: 'None',
      inputHint: 'SingleLine',
      isSearchable: false,
      type: { name: 'text' },
    },
    {
      name: 'nolabel',
      label: {},
      level: 'Product',
      isRequired: false,
      attributeConstraint: 'None',
      inputHint: 'SingleLine',
      isSearchable: false,
      type: { name: 'text' },
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModifiedAt: '2026-01-01T00:00:00.000Z',
};

function createProjection(attributes: Attribute[], withType = true): ProductProjection {
  return {
    id: 'id-1',
    version: 1,
    key: 'drill-1',
    productType: { typeId: 'product-type', id: 'pt-1', obj: withType ? productType : undefined },
    name: { en: 'Drill', da: 'Bor' },
    slug: { en: 'drill', da: 'bor' },
    categories: [],
    masterVariant: { id: 1, sku: 'sku-1', images: [], attributes },
    variants: [],
    attributes: [],
    hasStagedChanges: false,
    published: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModifiedAt: '2026-01-01T00:00:00.000Z',
  };
}

const taxonomyAttributes: Attribute[] = [
  { name: 'icecat-feature-1765', value: [{ en: '18 V', da: '18 volt' }, { en: '12 V' }] },
  { name: 'term_features', value: [
    { key: 'features__cordless', label: { en: 'Cordless', da: 'Traadloes' } },
    { key: 'features__outdoor__rated', label: { en: 'Outdoor rated' } },
  ] },
  { name: 'term_brands', value: [{ key: 'brands__acme', label: { en: 'Acme' } }] },
  { name: 'flags', value: [{ key: 'ageRestricted', label: 'Age restricted' }, { key: 'bogus', label: 'Bogus' }] },
  { name: 'colour', value: 'red' },
];

function setup(locale = 'en-US') {
  const context = createInitialRequestContext();
  context.languageContext.locale = locale;
  return { context, factory: new CommercetoolsProductFactory(ProductSchema) };
}

describe('Commercetools product factory taxonomy mapping', () => {
  it('labels attributes from the product type for the request locale', () => {
    const { context, factory } = setup('da-DK');

    const product = factory.parseProduct(context, createProjection(taxonomyAttributes));

    const voltage = product.sharedAttributes.find((a) => a.identifier.key === 'icecat-feature-1765');
    expect(voltage?.name).toBe('Batterispaending');
    expect(voltage?.values.map((v) => v.label)).toEqual(['18 volt', '12 V']);
    expect(product.sharedAttributes.find((a) => a.identifier.key === 'colour')?.name).toBe('Colour');
  });

  it('falls back to the machine name when the type has no label or no type is present', () => {
    const { context, factory } = setup();

    const withEmptyLabel = factory.parseProduct(context, createProjection([{ name: 'nolabel', value: 'x' }]));
    expect(withEmptyLabel.sharedAttributes[0].name).toBe('nolabel');

    const withoutType = factory.parseProduct(context, createProjection(taxonomyAttributes, false));
    expect(withoutType.productType).toBeUndefined();
    expect(withoutType.sharedAttributes.find((a) => a.identifier.key === 'icecat-feature-1765')?.name).toBe('icecat-feature-1765');
  });

  it('maps the product type without the managed prefix', () => {
    const { context, factory } = setup();

    const product = factory.parseProduct(context, createProjection([]));

    expect(product.productType).toEqual({ identifier: { key: 'icecat-cat-8862' }, name: 'Drills' });
  });

  it('maps term attributes to terms and decodes the term id', () => {
    const { context, factory } = setup('da-DK');

    const product = factory.parseProduct(context, createProjection(taxonomyAttributes));

    expect(product.terms).toEqual([
      { identifier: { key: 'features/cordless' }, vocabulary: 'features', name: 'Traadloes' },
      { identifier: { key: 'features/outdoor__rated' }, vocabulary: 'features', name: 'Outdoor rated' },
      { identifier: { key: 'brands/acme' }, vocabulary: 'brands', name: 'Acme' },
    ]);
  });

  it('keeps taxonomy attributes out of shared attributes and variant options', () => {
    const { context, factory } = setup();

    const product = factory.parseProduct(context, createProjection(taxonomyAttributes));

    const keys = product.sharedAttributes.map((a) => a.identifier.key);
    expect(keys).not.toContain('flags');
    expect(keys.filter((k) => k.startsWith('term_'))).toEqual([]);
    // the shared feature is SameForAll and the term and flag attributes are no options, the colour is
    expect(product.mainVariant.options.map((o) => o.identifier.key)).toEqual(['colour']);
  });

  it('maps flags and drops unknown ones', () => {
    const { context, factory } = setup();

    const product = factory.parseProduct(context, createProjection(taxonomyAttributes));

    expect(product.flags).toEqual(['ageRestricted']);
  });

  it('parses enum values of shared attributes by key and label', () => {
    const { context, factory } = setup('da-DK');

    const product = factory.parseProduct(
      context,
      createProjection([{ name: 'material', value: { key: 'steel', label: { da: 'Staal', en: 'Steel' } } }]),
    );

    expect(product.sharedAttributes[0].values[0]).toMatchObject({
      identifier: { key: 'steel' },
      value: 'steel',
      label: 'Staal',
    });
  });
});

describe('Commercetools product capability product types', () => {
  const config = useCommercetoolsFixtures('product');

  it('fetches the product type once and maps taxonomy', async () => {
    const context = createInitialRequestContext();
    context.languageContext.locale = 'da-DK';
    const capability = new CommercetoolsProductCapability(
      new MemoryCache(),
      context,
      config,
      new CommercetoolsAPI(config, context),
      new CommercetoolsProductFactory(ProductSchema),
    );

    const first = await capability.getById({ identifier: { key: 'drill-1' } });
    const second = await capability.getById({ identifier: { key: 'drill-2' } });

    if (!first.success || !second.success) {
      assert.fail();
    }
    // the replayed fixture only holds one product type request, a second one would fail the replay
    expect(first.value.productType?.identifier.key).toBe('icecat-cat-8862');
    expect(second.value.productType?.identifier.key).toBe('icecat-cat-8862');
    expect(first.value.sharedAttributes.find((a) => a.identifier.key === 'icecat-feature-1765')?.name).toBe('Batterispaending');
    expect(first.value.terms[0]).toMatchObject({ identifier: { key: 'features/cordless' }, name: 'Traadloes' });
    expect(first.value.flags).toEqual(['ageRestricted']);
  });
});
