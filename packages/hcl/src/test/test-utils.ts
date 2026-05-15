import {
  ClientBuilder,
  NoOpCache,
  createInitialRequestContext,
  type RequestContext,
} from '@reactionary/core';
import { withHclCapabilities } from '../core/initialize.js';
import {
  HclConfigurationSchema,
  type HclConfiguration,
} from '../schema/configuration.schema.js';

export function getHclTestConfiguration(): HclConfiguration {
  return HclConfigurationSchema.parse({
    apiUrl: process.env['HCL_API_URL'] || '',
    storeId: process.env['HCL_STORE_ID'] || '',
    catalogId: process.env['HCL_CATALOG_ID'] || undefined,
    profiles: {
      product: process.env['HCL_PROFILE_PRODUCT'] || undefined,
      productSearch: process.env['HCL_PROFILE_PRODUCT_SEARCH'] || undefined,
      categoryBrowse: process.env['HCL_PROFILE_CATEGORY_BROWSE'] || undefined,
    },
    localeMap: {
      'en-US': process.env['HCL_LANG_ID_EN_US'] || '-1',
    },
  });
}

export function createHclClient(
  contextOverrides: Partial<RequestContext> = {},
) {
  const context = { ...createInitialRequestContext(), ...contextOverrides };
  return new ClientBuilder(context)
    .withCache(new NoOpCache())
    .withCapability(
      withHclCapabilities(getHclTestConfiguration(), {
        product: { enabled: true },
        category: { enabled: true },
        productSearch: { enabled: true },
      }),
    )
    .build();
}
