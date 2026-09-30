import type { StoreProduct } from '@medusajs/types';
import {
  ProductSearchResultItemComplianceDataSchema,
  type ProductSearchResultItemComplianceData,
} from '@reactionary/core';
import { safeBoolConvert, safeStringConvert } from './medusa-helpers.js';

export function parseProductSearchComplianceData(
  product: Pick<StoreProduct, 'metadata'>,
): ProductSearchResultItemComplianceData {
  if (!product.metadata) {
    return ProductSearchResultItemComplianceDataSchema.parse({});
  }

  const metadata = product.metadata;
  const duration = safeStringConvert(metadata['compliance_data_garan_duration']);
  return ProductSearchResultItemComplianceDataSchema.parse({
    ce_marking: safeBoolConvert(metadata['compliance_data_ce_marking']),
    weee_symbol: safeBoolConvert(metadata['compliance_data_weee_symbol']),
    energy_class: safeStringConvert(metadata['compliance_data_energy_class']),
    garan_duration:
       (duration === undefined || !Number.isFinite(Number(duration)))
         ? undefined
         : Number(duration),
    is_organic: safeBoolConvert(metadata['compliance_data_organic_is_organic']),
    organic_certification_type: safeStringConvert(metadata['compliance_data_organic_certification_type']),
  });
}
