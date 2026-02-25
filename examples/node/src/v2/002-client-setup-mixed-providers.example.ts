import {
  createClient,
  createInitialRequestContext,
  type ProcedureContext,
  type RequestContext,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { commercetoolsCapabilitiesInitializer } from '@reactionary/commercetools';
import {
  algoliaCapabilitiesInitializer,
  type AlgoliaConfiguration,
} from '@reactionary/algolia';

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

export function getAlgoliaConfiguration(): AlgoliaConfiguration {
  return {
    appId: 'your-app-id',
    apiKey: 'your-search-api-key',
    indexName: 'products',
  };
}

export function getContext(): ProcedureContext {
  return {
    request: createInitialRequestContext(),
  };
}

export function createMixedClient() {
  const withCommercetools = commercetoolsCapabilitiesInitializer(
    getCommercetoolsConfiguration(),
    {
      product: true,
      cart: true,
    },
  );

  const withAlgolia = algoliaCapabilitiesInitializer(
    getAlgoliaConfiguration(),
    {
      productSearch: true,
      analytics: true
    },
  );

  return createClient(getContext(), withCommercetools, withAlgolia);
}

const client = createMixedClient();
