import { describe, expect, it } from 'vitest';
import { parseHclSeo } from '../core/seo.js';
import type { HclSeoPage } from '../schema/hcl.schema.js';

const page: HclSeoPage = {
  name: 'PRODUCT_PAGE',
  type: 'Product',
  title: 'Wooden Dining Chair | Store',
  metaDescription: 'A sturdy chair.',
  metaKeyword: 'chair, wood',
};

describe('parseHclSeo', () => {
  it('maps the title and meta description, and leaves out keywords', () => {
    expect(parseHclSeo(page)).toEqual({
      title: 'Wooden Dining Chair | Store',
      description: 'A sturdy chair.',
    });
  });

  it('returns undefined without a page, as getById and getBySKU have none', () => {
    expect(parseHclSeo(undefined)).toBeUndefined();
  });

  it('treats blank values as not authored', () => {
    expect(parseHclSeo({ ...page, title: '  ', metaDescription: '' })).toBeUndefined();
  });
});
