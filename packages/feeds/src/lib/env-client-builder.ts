import { withAlgoliaCapabilities } from '@reactionary/algolia';
import {
  withCommercetoolsCapabilities,
  type CommercetoolsConfiguration,
} from '@reactionary/commercetools';
import {
  ClientBuilder,
  MemoryCache,
  createInitialRequestContext,
  type Cache,
  type RequestContext,
} from '@reactionary/core';
import { withFakeCapabilities, type FakeConfiguration } from '@reactionary/fake';
import { withMagentoCapabilities, type MagentoConfiguration } from '@reactionary/magento';
import { withMedusaCapabilities } from '@reactionary/medusa';
import {
  withMeilisearchCapabilities,
  type MeilisearchConfiguration,
} from '@reactionary/meilisearch';
import type {
  ReactionaryFeedClient,
  ReactionaryFeedClientFactory,
} from './feed-types.js';
import { loadCwdEnv } from './load-cwd-env.js';

export type ReactionaryFeedProviderSystem =
  | 'ALGOLIA'
  | 'COMMERCETOOLS'
  | 'FAKE'
  | 'MAGENTO'
  | 'MEDUSA'
  | 'MEILISEARCH'
  | 'UNOMI';

export interface CreateReactionaryFeedClientFromEnvOptions {
  env?: NodeJS.ProcessEnv;
  contextOverrides?: Partial<RequestContext>;
  cache?: Cache;
  loadEnv?: boolean;
}

export interface ReactionaryFeedClientFromEnv {
  client: ReactionaryFeedClient;
  enabledSystems: ReactionaryFeedProviderSystem[];
}

const providerSystems: ReactionaryFeedProviderSystem[] = [
  'FAKE',
  'MAGENTO',
  'MEDUSA',
  'COMMERCETOOLS',
  'ALGOLIA',
  'MEILISEARCH',
  'UNOMI',
];

export function createReactionaryFeedClientFromEnv(
  options: CreateReactionaryFeedClientFromEnvOptions = {},
): ReactionaryFeedClientFromEnv {
  if (options.loadEnv !== false) {
    loadCwdEnv({
      env: options.env,
    });
  }

  const env = options.env ?? process.env;
  const enabledSystems = getEnabledReactionaryFeedProviderSystems(env);

  if (enabledSystems.length === 0) {
    throw new Error(getNoEnabledProviderSystemsMessage());
  }

  const context = {
    ...createInitialRequestContext(),
    ...options.contextOverrides,
  };
  let builder = new ClientBuilder(context).withCache(
    options.cache ?? new MemoryCache(),
  );

  for (const system of enabledSystems) {
    switch (system) {
      case 'ALGOLIA':
        builder = builder.withCapability(
          withAlgoliaCapabilities(getAlgoliaConfiguration(env), {
            productSearch: { enabled: true },
          }),
        );
        break;
      case 'COMMERCETOOLS':
        builder = builder.withCapability(
          withCommercetoolsCapabilities(getCommercetoolsConfiguration(env), {
            product: { enabled: true },
            category: { enabled: true },
            inventory: { enabled: true },
            price: { enabled: true },
            productSearch: { enabled: true },
            productReviews: { enabled: true },
            store: { enabled: true },
          }),
        );
        break;
      case 'FAKE':
        builder = builder.withCapability(
          withFakeCapabilities(getFakeConfiguration(), {
            productSearch: { enabled: true },
            category: { enabled: true },
            store: { enabled: true },
            price: { enabled: true },
            inventory: { enabled: true },
            product: { enabled: true },
            productReviews: { enabled: true },
          }),
        );
        break;
      case 'MAGENTO':
        builder = builder.withCapability(
          withMagentoCapabilities(getMagentoConfiguration(env), {
            product: { enabled: true },
            category: { enabled: true },
            inventory: { enabled: true },
            price: { enabled: true },
            productSearch: { enabled: true },
            productReviews: { enabled: true },
          }),
        );
        break;
      case 'MEDUSA':
        builder = builder.withCapability(
          withMedusaCapabilities(getMedusaConfiguration(env), {
            product: { enabled: true },
            category: { enabled: true },
            inventory: { enabled: true },
            price: { enabled: true },
            productSearch: { enabled: true },
          }),
        );
        break;
      case 'MEILISEARCH':
        builder = builder.withCapability(
          withMeilisearchCapabilities(getMeilisearchConfiguration(env), {
            productSearch: { enabled: true },
          }),
        );
        break;
      case 'UNOMI':
        break;
    }
  }

  return {
    client: builder.build(),
    enabledSystems,
  };
}

export function createReactionaryFeedClientFactoryFromEnv(
  options: Omit<CreateReactionaryFeedClientFromEnvOptions, 'contextOverrides'> = {},
): ReactionaryFeedClientFactory {
  return (requestContext) =>
    createReactionaryFeedClientFromEnv({
      ...options,
      contextOverrides: requestContext,
    }).client;
}

export function getEnabledReactionaryFeedProviderSystems(
  env: NodeJS.ProcessEnv = process.env,
): ReactionaryFeedProviderSystem[] {
  return providerSystems.filter((system) =>
    isEnvEnabled(env[`ENABLED_${system}`]),
  );
}

export function getNoEnabledProviderSystemsMessage(): string {
  return `No Reactionary provider system is enabled. Set one of ${providerSystems
    .map((system) => `ENABLED_${system}=true`)
    .join(', ')}.`;
}

export function parseCommaSeparatedEnvList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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

function getCommercetoolsConfiguration(
  env: NodeJS.ProcessEnv,
): CommercetoolsConfiguration {
  return {
    apiUrl: env['CTP_API_URL'] || '',
    authUrl: env['CTP_AUTH_URL'] || '',
    clientId: env['CTP_CLIENT_ID'] || '',
    clientSecret: env['CTP_CLIENT_SECRET'] || '',
    projectKey: env['CTP_PROJECT_KEY'] || '',
    scopes: parseCommaSeparatedEnvList(env['CTP_SCOPES']),
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
    facetFieldsForSearch: parseCommaSeparatedEnvList(
      env['CTP_FACET_FIELDS_FOR_SEARCH'],
    ),
    adminClientId: env['CTP_ADMIN_CLIENT_ID'] || undefined,
    adminClientSecret: env['CTP_ADMIN_CLIENT_SECRET'] || undefined,
    listPriceChannelKey: env['CTP_LIST_PRICE_CHANNEL_KEY'] || undefined,
    customerPriceChannelKey: env['CTP_CUSTOMER_PRICE_CHANNEL_KEY'] || undefined,
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

function getMedusaConfiguration(env: NodeJS.ProcessEnv) {
  return {
    publishable_key: env['MEDUSA_PUBLISHABLE_KEY'] || '',
    adminApiKey: env['MEDUSA_ADMIN_KEY'] || '',
    apiUrl: env['MEDUSA_API_URL'] || '',
    defaultCurrency: env['MEDUSA_DEFAULT_CURRENCY'] || '',
    allCurrencies: [],
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
