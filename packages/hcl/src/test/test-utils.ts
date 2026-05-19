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
  const config = HclConfigurationSchema.parse({
    apiUrl: process.env['HCL_API_URL'],
    searchApiUrl: process.env['HCL_SEARCH_API_URL'] || undefined,
    storeId: process.env['HCL_STORE_ID'],
    catalogId: process.env['HCL_CATALOG_ID'] || undefined,
  });
  if (!config.searchApiUrl) {
    config.searchApiUrl = config.apiUrl;
  }
  return config;
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
