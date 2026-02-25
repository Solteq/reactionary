import {
  ProductSchema,
  createClient,
  createInitialRequestContext,
  type ProcedureContext,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { commercetoolsCapabilitiesInitializer } from '@reactionary/commercetools';
import * as z from 'zod';

export function getCommercetoolsConfiguration(): CommercetoolsConfiguration {
  return {
    projectKey: 'your-ct-project-key',
    authUrl: 'https://auth.europe-west1.gcp.commercetools.com',
    apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    scopes: ['manage_project:your-ct-project-key'],
    paymentMethods: [],
    facetFieldsForSearch: [],
  };
}

export function getContext(): ProcedureContext {
  return {
    request: createInitialRequestContext(),
  };
}

const ExtendedProductSchema = ProductSchema.extend({
  merchandisingTag: z.string(),
  rawProviderName: z.literal('commercetools'),
});

export function createExtendedProductClient() {
  const withCommercetools = commercetoolsCapabilitiesInitializer(
    getCommercetoolsConfiguration(),
    {
      product: true,
    },
    {
      product: {
        schema: ExtendedProductSchema,
        transform: ({ product }) => ({
          ...product,
          merchandisingTag: product.name.includes('Sale') ? 'sale' : 'default',
          rawProviderName: 'commercetools' as const,
        }),
      },
    },
  );

  return createClient(getContext(), withCommercetools);
}

const client = createExtendedProductClient();

const product = await client.product.bySlug.execute({
  slug: 'sample-product-slug',
});

if (!product.success) {
  throw Error('Expected product.bySlug to succeed.');
}

// Fully typed from ExtendedProductSchema:
console.log(product.value.merchandisingTag);
console.log(product.value.rawProviderName);
