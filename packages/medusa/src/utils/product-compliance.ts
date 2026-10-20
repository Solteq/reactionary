import type { StoreProduct } from '@medusajs/types';
import {
  ProductSearchResultItemComplianceDataSchema,
  type ProductSearchResultItemComplianceData,
} from '@reactionary/core';
import { safeBoolConvert, safeStringConvert } from './medusa-helpers.js';

/** Scale text such as "A++-G" or "A+++ to D"; kept short and printable, interpreted by the storefront. */
function parseEnergyClassRange(value: unknown): string | undefined {
  const text = safeStringConvert(value)?.trim();
  return text && /^[A-Za-z0-9+\-–_ ]{1,20}$/.test(text) ? text : undefined;
}

/** EPREL registration numbers are digits only (up to 19). Anything else is dropped rather than passed on. */
function parseEprelRegistrationNumber(value: unknown): string | undefined {
  const text = safeStringConvert(value)?.trim();
  return text && /^\d{1,19}$/.test(text) ? text : undefined;
}

/** EPREL product group URL codes are lowercase alphanumerics, e.g. "spaceheaters". */
function parseEprelProductGroup(value: unknown): string | undefined {
  const text = safeStringConvert(value)?.trim().toLowerCase();
  return text && /^[a-z0-9]{1,64}$/.test(text) ? text : undefined;
}

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
    energy_class_range: parseEnergyClassRange(metadata['compliance_data_energy_class_range']),
    garan_duration:
       (duration === undefined || !Number.isFinite(Number(duration)))
         ? undefined
         : Number(duration),
    eprel_registration_number: parseEprelRegistrationNumber(metadata['compliance_data_eprel_registration_number']),
    eprel_product_group: parseEprelProductGroup(metadata['compliance_data_eprel_product_group']),
    is_organic: safeBoolConvert(metadata['compliance_data_organic_is_organic']),
    organic_certification_type: safeStringConvert(metadata['compliance_data_organic_certification_type']),
  });
}
