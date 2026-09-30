import {
  ClientBuilder,
  NoOpCache,
  createInitialRequestContext,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/algolia';
import {
  withCommercetoolsCapabilities,
  type CommercetoolsConfiguration,
} from '@reactionary/commercetools';
import { withFakeCapabilities, type FakeConfiguration } from '@reactionary/fake';
import { withMagentoCapabilities, type MagentoConfiguration } from '@reactionary/magento';
import { withMedusaCapabilities } from '@reactionary/medusa';
import {
  withMeilisearchCapabilities,
  type MeilisearchConfiguration,
} from '@reactionary/meilisearch';
import { withUnomiCapabilities } from '@reactionary/unomi';
import type { ReactionaryMCPClient } from './tool-discovery.js';

export type ReactionaryMCPProviderSystem =
  | 'ALGOLIA'
  | 'COMMERCETOOLS'
  | 'FAKE'
  | 'MAGENTO'
  | 'MEDUSA'
  | 'MEILISEARCH'
  | 'UNOMI';

export interface CreateReactionaryClientFromEnvOptions {
  env?: NodeJS.ProcessEnv;
  contextOverrides?: Partial<RequestContext>;
  cache?: Cache;
}

export interface ReactionaryMCPClientFromEnv {
  client: ReactionaryMCPClient;
  enabledSystems: ReactionaryMCPProviderSystem[];
}

const providerSystems: ReactionaryMCPProviderSystem[] = [
  'FAKE',
  'MAGENTO',
  'MEDUSA',
  'COMMERCETOOLS',
  'ALGOLIA',
  'MEILISEARCH',
  'UNOMI',
];

export function createReactionaryClientFromEnv(
  options: CreateReactionaryClientFromEnvOptions = {},
): ReactionaryMCPClientFromEnv {
  const env = options.env ?? process.env;
  const enabledSystems = providerSystems.filter((system) =>
    isEnvEnabled(env[`ENABLED_${system}`]),
  );

  if (enabledSystems.length === 0) {
    throw new Error(
      `No Reactionary provider system is enabled. Set one of ${providerSystems
        .map((system) => `ENABLED_${system}=true`)
        .join(', ')}.`,
    );
  }

  const context = {
    ...createInitialRequestContext(),
    ...options.contextOverrides,
  };
  let builder = new ClientBuilder(context).withCache(
    options.cache ?? new NoOpCache(),
  );

  for (const system of enabledSystems) {
    switch (system) {
      case 'ALGOLIA':
        builder = builder.withCapability(
          withAlgoliaCapabilities(getAlgoliaConfiguration(env), {
            productSearch: { enabled: true },
            productRecommendations: { enabled: true },
          }),
        );
        break;
      case 'COMMERCETOOLS':
        builder = builder.withCapability(
          withCommercetoolsCapabilities(getCommercetoolsConfiguration(env), {
            cart: { enabled: true },
            product: { enabled: true },
            category: { enabled: true },
            checkout: { enabled: true },
            identity: { enabled: true },
            inventory: { enabled: true },
            order: { enabled: true },
            price: { enabled: true },
            productSearch: { enabled: true },
            productAssociations: { enabled: true },
            productReviews: { enabled: true },
            productList: { enabled: true },
            orderSearch: { enabled: true },
            companyRegistration: { enabled: true },
            company: { enabled: true },
            employee: { enabled: true },
            employeeInvitation: { enabled: true },
            store: { enabled: true },
            profile: { enabled: true },
            personalizationProfile: { enabled: true },
          }),
        );
        break;
      case 'FAKE':
        builder = builder.withCapability(
          withFakeCapabilities(getFakeConfiguration(), {
            price: { enabled: true },
            inventory: { enabled: true },
            product: { enabled: true },
            productReviews: { enabled: true },
            productAssociations: { enabled: true },
            featureFlag: { enabled: true },
          }),
        );
        break;
      case 'MAGENTO':
        builder = builder.withCapability(
          withMagentoCapabilities(getMagentoConfiguration(env), {
            cart: { enabled: true },
            product: { enabled: true },
            category: { enabled: true },
            identity: { enabled: true },
            inventory: { enabled: true },
            price: { enabled: true },
            productSearch: { enabled: true },
            profile: { enabled: true },
            orderSearch: { enabled: true },
            checkout: { enabled: true },
            productAssociations: { enabled: true },
            productRecommendations: { enabled: true },
            productReviews: { enabled: true },
          }),
        );
        break;
      case 'MEDUSA':
        builder = builder.withCapability(
          withMedusaCapabilities(getMedusaConfiguration(env), {
            cart: { enabled: true },
            product: { enabled: true },
            category: { enabled: true },
            checkout: { enabled: true },
            identity: { enabled: true },
            inventory: { enabled: true },
            order: { enabled: true },
            price: { enabled: true },
            productSearch: { enabled: true },
            productRecommendations: { enabled: true },
            productAssociations: { enabled: true },
            orderSearch: { enabled: true },
            store: { enabled: true },
            profile: { enabled: true },
            personalizationProfile: { enabled: true },
            employee: { enabled: true },
            employeeInvitation: { enabled: true },
            company: { enabled: true },
            companyRegistration: { enabled: true },
          }),
        );
        break;
      case 'MEILISEARCH':
        builder = builder.withCapability(
          withMeilisearchCapabilities(getMeilisearchConfiguration(env), {
            productSearch: { enabled: true },
            orderSearch: { enabled: true },
            productRecommendations: { enabled: true },
          }),
        );
        builder = builder.withCapability(
          withMedusaCapabilities(getMedusaConfiguration(env), {
            cart: { enabled: true },
            identity: { enabled: true },
          }),
        );
        break;
      case 'UNOMI':
        builder = builder.withCapability(
          withUnomiCapabilities(getUnomiConfiguration(env), {
            personalizationProfile: { enabled: true },
            analytics: { enabled: false },
          }),
        );
        builder = builder.withCapability(
          withMedusaCapabilities(getMedusaConfiguration(env), {
            cart: { enabled: true },
            identity: { enabled: true },
          }),
        );
        break;
    }
  }

  return {
    client: builder.build(),
    enabledSystems,
  };
}

function isEnvEnabled(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

function getAlgoliaConfiguration(env: NodeJS.ProcessEnv) {
  return {
    apiKey: env['ALGOLIA_API_KEY'] || '',
    appId: env['ALGOLIA_APP_ID'] || '',
    indexName: env['ALGOLIA_INDEX'] || '',
    useRecommendationsForBots:
      env['ALGOLIA_USE_RECOMMENDATIONS_FOR_BOTS'] === 'true',
    useBaseIndexNameForEnglishLocale:
      env['ALGOLIA_USE_BASE_INDEX_NAME_FOR_ENGLISH_LOCALE'] === 'true',
  };
}

function getMeilisearchConfiguration(
  env: NodeJS.ProcessEnv,
): MeilisearchConfiguration {
  return {
    apiKey: env['MEILISEARCH_API_KEY'] || '',
    apiUrl: env['MEILISEARCH_API_URL'] || '',
    indexName: env['MEILISEARCH_INDEX'] || '',
    useAIEmbedding: env['MEILISEARCH_USE_AI_EMBEDDING'] || undefined,
    semanticRatio: env['MEILISEARCH_SEMANTIC_RATIO']
      ? parseFloat(env['MEILISEARCH_SEMANTIC_RATIO'])
      : 0.5,
    orderIndexName: env['MEILISEARCH_ORDER_INDEX'] || 'order',
    useRecommendationsForBots:
      env['MEILISEARCH_USE_RECOMMENDATIONS_FOR_BOTS'] === 'true',
  };
}

function getUnomiConfiguration(env: NodeJS.ProcessEnv) {
  return {
    apiUrl: env['UNOMI_API_URL'] || '',
    username: env['UNOMI_USERNAME'] || '',
    password: env['UNOMI_PASSWORD'] || '',
    scope: env['UNOMI_SCOPE'] || '',
    profilePath: env['UNOMI_PROFILE_PATH'] || '/cxs/profiles',
  };
}

function getMedusaConfiguration(env: NodeJS.ProcessEnv) {
  return {
    publishable_key: env['MEDUSA_PUBLISHABLE_KEY'] || '',
    adminApiKey: env['MEDUSA_ADMIN_KEY'] || '',
    apiUrl: env['MEDUSA_API_URL'] || '',
    defaultCurrency: env['MEDUSA_DEFAULT_CURRENCY'] || '',
    allCurrencies: [],
  };
}

function getMagentoConfiguration(env: NodeJS.ProcessEnv): MagentoConfiguration {
  return {
    adminApiKey: env['MAGENTO_ADMIN_API_KEY'] || '',
    baseUrl: env['MAGENTO_BASE_URL'] || '',
    storeCode: env['MAGENTO_STORE_CODE'] || '',
    authStoreCode: env['MAGENTO_AUTH_STORE_CODE'] || 'default',
    mediaUrl: env['MAGENTO_MEDIA_URL'] || undefined,
    mediaSource:
      env['MAGENTO_MEDIA_SOURCE'] === 'EXTERNAL' ? 'EXTERNAL' : 'DEFAULT',
    defaultCurrency: env['MAGENTO_DEFAULT_CURRENCY'] || '',
    rootCategoryId: env['MAGENTO_ROOT_CATEGORY_ID'] || '2',
    graphqlUrl: env['MAGENTO_GRAPHQL_URL'] || undefined,
    reviewRatingCode: env['MAGENTO_REVIEW_RATING_CODE'] || undefined,
    allCurrencies: [],
  };
}

function getFakeConfiguration(): FakeConfiguration {
  return {
    jitter: {
      mean: 0,
      deviation: 0,
    },
    seeds: {
      product: 1,
      search: 1,
      category: 1,
    },
    featureFlags: {
      flags: [
        {
          key: 'true-flag',
          type: 'boolean',
          enabled: true,
        },
        {
          key: 'string-flag',
          type: 'multivariate',
          variants: ['red', 'green', 'blue'],
          enabledVariant: 'blue',
        },
      ],
    },
  };
}

function getCommercetoolsConfiguration(
  env: NodeJS.ProcessEnv,
): CommercetoolsConfiguration {
  return {
    apiUrl: env['CTP_API_URL'] || '',
    authUrl: env['CTP_AUTH_URL'] || '',
    clientId: env['CTP_CLIENT_ID'] || '',
    clientSecret: env['CTP_CLIENT_SECRET'] || '',
    projectKey: env['CTP_PROJECT_KEY'] || '',
    scopes: (env['CTP_SCOPES'] || '')
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0),
    paymentMethods: [
      {
        identifier: {
          method: 'stripe',
          name: 'Stripe',
          paymentProcessor: 'stripe',
        },
        isPunchOut: false,
        description: 'Stripe payment gateway',
      },
    ],
    facetFieldsForSearch: (env['CTP_FACET_FIELDS_FOR_SEARCH'] || '').split(','),
    adminClientId: env['CTP_ADMIN_CLIENT_ID'] || undefined,
    adminClientSecret: env['CTP_ADMIN_CLIENT_SECRET'] || undefined,
    listPriceChannelKey: env['CTP_LIST_PRICE_CHANNEL_KEY'] || undefined,
    customerPriceChannelKey: env['CTP_CUSTOMER_PRICE_CHANNEL_KEY'] || undefined,
  };
}
