import { ProductSchema, createInitialRequestContext } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MagentoProductFactory } from '../factories/product/product.factory.js';
import type { MagentoAttributeCatalog, MagentoAttributeMetadata } from '../schema/catalog.types.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';
import type { MagentoProduct } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR'],
});

const context = createInitialRequestContext();

function attribute(partial: Partial<MagentoAttributeMetadata> & { code: string }): MagentoAttributeMetadata {
  return {
    attributeId: '',
    label: partial.code,
    frontendInput: 'text',
    visibleOnFront: false,
    userDefined: true,
    options: [],
    ...partial,
  };
}

const ATTRIBUTES: MagentoAttributeCatalog = {
  complete: true,
  attributes: [
    attribute({
      attributeId: '93',
      code: 'color',
      label: 'Color',
      frontendInput: 'select',
      options: [
        { value: '49', label: 'Red' },
        { value: '50', label: 'Blue' },
      ],
    }),
    attribute({
      attributeId: '144',
      code: 'size',
      label: 'Size',
      frontendInput: 'select',
      options: [
        { value: '166', label: 'M' },
        { value: '167', label: 'L' },
      ],
    }),
    attribute({
      attributeId: '83',
      code: 'manufacturer',
      label: 'Manufacturer',
      frontendInput: 'select',
      options: [{ value: '7', label: 'Acme' }],
    }),
    attribute({
      code: 'material',
      label: 'Material',
      frontendInput: 'multiselect',
      visibleOnFront: true,
      options: [
        { value: '1', label: 'Cotton' },
        { value: '2', label: 'Wool' },
      ],
    }),
    attribute({ code: 'care', label: 'Care instructions', visibleOnFront: true }),
    attribute({ code: 'internal_note', label: 'Internal', visibleOnFront: false }),
  ],
};

function product(partial: Partial<MagentoProduct> = {}): MagentoProduct {
  return {
    id: 10,
    sku: 'MH01',
    name: 'Hoodie',
    status: 1,
    visibility: 4,
    type_id: 'simple',
    attribute_set_id: 4,
    custom_attributes: [],
    ...partial,
  };
}

function child(sku: string, color: string, size: string, status = 1): MagentoProduct {
  return product({
    id: Number(sku.replace(/\D/g, '')),
    sku,
    name: `Hoodie ${sku}`,
    visibility: 1,
    status,
    custom_attributes: [
      { attribute_code: 'color', value: color },
      { attribute_code: 'size', value: size },
    ],
  });
}

describe('MagentoProductFactory', () => {
  const factory = new MagentoProductFactory(ProductSchema, config);

  it('maps short_description to description and description to longDescription', () => {
    const parsed = factory.parseProduct(
      context,
      product({
        custom_attributes: [
          { attribute_code: 'short_description', value: 'Short' },
          { attribute_code: 'description', value: '<p>Long</p>' },
        ],
      }),
    );
    expect(parsed.description).toBe('Short');
    expect(parsed.longDescription).toBe('<p>Long</p>');
  });

  it('derives published from the status', () => {
    expect(factory.parseProduct(context, product({ status: 1 })).published).toBe(true);
    expect(factory.parseProduct(context, product({ status: 2 })).published).toBe(false);
  });

  it('resolves brand and manufacturer option ids to labels', () => {
    const parsed = factory.parseProduct(context, {
      product: product({ custom_attributes: [{ attribute_code: 'manufacturer', value: '7' }] }),
      attributes: ATTRIBUTES,
    });
    expect(parsed.manufacturer).toBe('Acme');
    expect(parsed.brand).toBe('Acme');
  });

  it('keys the product by external_id and its categories by category key', () => {
    const parsed = factory.parseProduct(context, {
      product: product({
        custom_attributes: [{ attribute_code: 'external_id', value: 'P-1' }],
        extension_attributes: {
          category_links: [
            { position: 0, category_id: '5' },
            { position: 1, category_id: '99' },
          ],
        },
      }),
      categoryKeys: { '5': 'CAT-SHIRTS' },
    });
    expect(parsed.identifier.key).toBe('P-1');
    // 99 is unknown to Magento and is dropped rather than leaking an entity id.
    expect(parsed.parentCategories).toEqual([{ key: 'CAT-SHIRTS' }]);
  });

  it('lists only storefront-visible attributes, with option labels, when metadata is complete', () => {
    const parsed = factory.parseProduct(context, {
      product: product({
        custom_attributes: [
          { attribute_code: 'material', value: '1,2' },
          { attribute_code: 'care', value: 'Wash cold' },
          { attribute_code: 'internal_note', value: 'secret' },
          { attribute_code: 'url_key', value: 'hoodie' },
          { attribute_code: 'description', value: 'Long' },
        ],
      }),
      attributes: ATTRIBUTES,
    });

    expect(parsed.sharedAttributes.map((a) => a.identifier.key)).toEqual(['material', 'care']);
    const material = parsed.sharedAttributes[0];
    expect(material.name).toBe('Material');
    expect(material.values.map((v) => v.label)).toEqual(['Cotton', 'Wool']);
  });

  it('excludes system attributes when the metadata is unavailable', () => {
    const parsed = factory.parseProduct(context, {
      product: product({
        custom_attributes: [
          { attribute_code: 'url_key', value: 'hoodie' },
          { attribute_code: 'tax_class_id', value: '2' },
          { attribute_code: 'required_options', value: '0' },
          { attribute_code: 'care', value: 'Wash cold' },
        ],
      }),
      attributes: { complete: false, attributes: [] },
    });
    expect(parsed.sharedAttributes.map((a) => a.identifier.key)).toEqual(['care']);
  });

  it('maps configurable children to variants and configurable attributes to options', () => {
    const parent = product({
      type_id: 'configurable',
      media_gallery_entries: [
        { id: 1, media_type: 'image', label: null, position: 1, disabled: false, types: ['image'], file: '/m/h/parent.jpg' },
      ],
    });
    const parsed = factory.parseProduct(context, {
      product: parent,
      children: [child('MH01-M-Red', '49', '166'), child('MH01-L-Red', '49', '167')],
      configurableOptions: [
        { attribute_id: '144', label: 'Size', position: 1, values: [{ value_index: 166 }, { value_index: 167 }] },
        { attribute_id: '93', label: 'Color', position: 0, values: [{ value_index: 49 }, { value_index: 50 }] },
      ],
      attributes: ATTRIBUTES,
    });

    expect(parsed.options.map((o) => o.identifier.key)).toEqual(['color', 'size']);
    // Blue (50) has no enabled child and is not offered.
    expect(parsed.options[0].values).toEqual([
      { identifier: { option: { key: 'color' }, key: '49' }, label: 'Red' },
    ]);
    expect(parsed.mainVariant.identifier.sku).toBe('MH01-M-Red');
    expect(parsed.mainVariant.options.map((o) => [o.identifier.key, o.value.label])).toEqual([
      ['color', 'Red'],
      ['size', 'M'],
    ]);
    // A child without its own images shows the parent's.
    expect(parsed.mainVariant.images[0].sourceUrl).toBe(
      'https://shop.example.com/media/catalog/product/m/h/parent.jpg',
    );
    expect(parsed.variants.map((v) => v.identifier.sku)).toEqual(['MH01-L-Red']);
  });

  it('makes the requested child SKU the main variant', () => {
    const parsed = factory.parseProduct(context, {
      product: product({ type_id: 'configurable' }),
      children: [child('MH01-M-Red', '49', '166'), child('MH01-L-Red', '49', '167')],
      configurableOptions: [],
      preferredSku: 'MH01-L-Red',
    });
    expect(parsed.mainVariant.identifier.sku).toBe('MH01-L-Red');
    expect(parsed.variants.map((v) => v.identifier.sku)).toEqual(['MH01-M-Red']);
  });

  it('takes images from the DAM reference when mediaSource is EXTERNAL', () => {
    const externalFactory = new MagentoProductFactory(ProductSchema, { ...config, mediaSource: 'EXTERNAL' });
    const parsed = externalFactory.parseProduct(
      context,
      product({
        custom_attributes: [
          {
            attribute_code: 'original_dam_reference',
            value: JSON.stringify({ images: [{ url: 'https://dam.example/a.jpg' }] }),
          },
        ],
      }),
    );
    expect(parsed.mainVariant.images.map((i) => i.sourceUrl)).toEqual(['https://dam.example/a.jpg']);
  });
});
