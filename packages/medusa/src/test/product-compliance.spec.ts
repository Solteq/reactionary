import { createInitialRequestContext, ProductSchema, ProductSearchResultSchema } from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import type { StoreProduct } from '@medusajs/types';
import { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { MedusaProductFactory } from '../factories/product/product.factory.js';
import { parseProductSearchComplianceData } from '../utils/product-compliance.js';

const product: StoreProduct = {
  id: 'prod_1',
  title: 'Test product',
  handle: 'test-product',
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

describe('Medusa product compliance parsing', () => {
  it('maps shared metadata to the compact compliance schema', () => {
    expect(parseProductSearchComplianceData({ metadata: {
      compliance_data_ce_marking: 'true',
      compliance_data_weee_symbol: false,
      compliance_data_energy_class: 'A',
      compliance_data_garan_duration: '36',
      compliance_data_organic_is_organic: 'true',
      compliance_data_organic_certification_type: 'EU_ORGANIC_LEAF',
    } })).toMatchObject({
      ce_marking: true,
      weee_symbol: false,
      energy_class: 'A',
      garan_duration: 36,
      is_organic: true,
      organic_certification_type: 'EU_ORGANIC_LEAF',
    });
  });

  it('uses schema defaults when metadata is absent', () => {
    expect(parseProductSearchComplianceData({ metadata: null })).toMatchObject({
      ce_marking: false,
      weee_symbol: false,
    });
  });

  it('maps shared fields into the full product compliance data', () => {
    const factory = new MedusaProductFactory(ProductSchema);
    const result = factory.parseComplianceData(createInitialRequestContext(), {
      ...product,
      metadata: {
        compliance_data_ce_marking: 'true',
        compliance_data_organic_is_organic: 'true',
        compliance_data_garan_duration: '36',
        compliance_data_traceability_manufacturer_name: 'Manufacturer',
      },
    });

    expect(result.ce_marking).toBe(true);
    expect(result.garan_duration).toBe(36);
    expect(result.organic?.is_organic).toBe(true);
    expect(result.traceability?.manufacturer.name).toBe('Manufacturer');
  });

  it('allows a child factory to override compliance parsing', () => {
    class CustomProductSearchFactory extends MedusaProductSearchFactory {
      protected override parseProductSearchComplianceData() {
        return { ce_marking: true, weee_symbol: false };
      }
    }

    const factory = new CustomProductSearchFactory(ProductSearchResultSchema);
    const result = factory.parseSearchResult(
      createInitialRequestContext(),
      { products: [product], count: 1, offset: 0, limit: 10 },
      { search: {
        term: 'test',
        facets: [],
        filters: [],
        paginationOptions: { pageNumber: 1, pageSize: 10 },
      } },
    );

    expect(result.items[0].complianceData?.ce_marking).toBe(true);
  });
});
