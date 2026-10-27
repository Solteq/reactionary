import type { StoreProduct, StoreProductCategory } from '@medusajs/types';
import {
  CategoryPaginatedResultSchema,
  CategorySchema,
  createInitialRequestContext,
  ProductSchema,
  type RequestContext,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MedusaCategoryFactory } from '../factories/category/category.factory.js';
import { MedusaProductFactory } from '../factories/product/product.factory.js';
import { parseMedusaSeo } from '../utils/seo.js';

function contextWithLocale(locale: string): RequestContext {
  const context = createInitialRequestContext();
  return { ...context, languageContext: { ...context.languageContext, locale } };
}

const baseCategory: StoreProductCategory = {
  id: 'pcat_1',
  name: 'Coffee',
  description: '',
  handle: 'coffee',
  rank: 0,
  external_id: 'coffee',
  parent_category_id: null,
  parent_category: null,
  category_children: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

const baseProduct: StoreProduct = {
  id: 'prod_1',
  title: 'Coffee maker',
  handle: 'coffee-maker',
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
  external_id: null,
  created_at: null,
  updated_at: null,
  deleted_at: null,
  variants: [],
  options: [],
  images: [],
};

const metadata = {
  seo_title_da: 'Dansk titel',
  seo_title_en: 'English title',
  'seo_title_da-DK': 'Dansk titel (DK)',
  seo_description_da: 'Dansk beskrivelse',
  seo_robots: 'noindex, follow',
};

describe('parseMedusaSeo', () => {
  it('prefers the exact locale over the bare language', () => {
    expect(parseMedusaSeo(contextWithLocale('da-DK'), metadata)).toEqual({
      title: 'Dansk titel (DK)',
      description: 'Dansk beskrivelse',
      robots: 'noindex, follow',
    });
  });

  it('falls back to the bare language', () => {
    expect(parseMedusaSeo(contextWithLocale('da-GL'), metadata)?.title).toBe('Dansk titel');
    expect(parseMedusaSeo(contextWithLocale('en-US'), metadata)?.title).toBe('English title');
  });

  it('never borrows another language', () => {
    const seo = parseMedusaSeo(contextWithLocale('fi-FI'), metadata);
    expect(seo?.title).toBeUndefined();
    expect(seo?.description).toBeUndefined();
  });

  it('applies robots regardless of locale', () => {
    expect(parseMedusaSeo(contextWithLocale('fi-FI'), metadata)?.robots).toBe('noindex, follow');
  });

  it('returns undefined when nothing is authored', () => {
    expect(parseMedusaSeo(contextWithLocale('da-DK'), null)).toBeUndefined();
    expect(parseMedusaSeo(contextWithLocale('da-DK'), { unrelated: 'x', seo_title_en: 'x' })).toBeUndefined();
  });

  it('treats blank values as not authored', () => {
    expect(parseMedusaSeo(contextWithLocale('da-DK'), { seo_title_da: '  ', seo_robots: '' })).toBeUndefined();
  });
});

describe('Medusa SEO in factories', () => {
  it('maps category metadata to seo', () => {
    const factory = new MedusaCategoryFactory(CategorySchema, CategoryPaginatedResultSchema);
    const category: StoreProductCategory = { ...baseCategory, metadata };

    expect(factory.parseCategory(contextWithLocale('da-DK'), category).seo).toEqual({
      title: 'Dansk titel (DK)',
      description: 'Dansk beskrivelse',
      robots: 'noindex, follow',
    });
  });

  it('leaves category seo unset without metadata', () => {
    const factory = new MedusaCategoryFactory(CategorySchema, CategoryPaginatedResultSchema);
    expect(factory.parseCategory(contextWithLocale('da-DK'), baseCategory).seo).toBeUndefined();
  });

  it('does not leak seo keys into product shared attributes', () => {
    class ExposedProductFactory extends MedusaProductFactory {
      public exposeAttributes(context: RequestContext, product: StoreProduct) {
        return this.parseAttributes(context, product);
      }
    }
    const factory = new ExposedProductFactory(ProductSchema);
    const product: StoreProduct = { ...baseProduct, metadata: { ...metadata, warranty: '2 years' } };

    const attributes = factory.exposeAttributes(contextWithLocale('da-DK'), product);
    const keys = attributes.map((attribute) => attribute.identifier.key);
    expect(keys.some((key) => key.startsWith('seo_'))).toBe(false);
    expect(keys).toContain('warranty');
  });
});
