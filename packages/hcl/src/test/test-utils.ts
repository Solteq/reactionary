import {
  HclConfigurationSchema,
  type HclConfiguration,
} from '../schema/configuration.schema.js';

export function getHclTestConfiguration(): HclConfiguration {
  return HclConfigurationSchema.parse({
    apiUrl: process.env['HCL_API_URL'] || '',
    storeId: process.env['HCL_STORE_ID'] || '',
    catalogId: process.env['HCL_CATALOG_ID'] || '',
    langId: process.env['HCL_LANG_ID'] || '-1',
    currency: process.env['HCL_CURRENCY'] || 'EUR',
  });
}
