import * as z from 'zod';

export const AlgoliaConfigurationSchema = z.looseObject({
    appId: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
    useBaseIndexNameForEnglishLocale: z.boolean().default(false).meta({ description: 'Deprecated. Whether to use the base index name, without locale suffix, for the English locale. By default, this is disabled and every locale, including English, uses an index with a locale suffix (e.g. products_en), which is what recalcitrant writes. Enable only for legacy setups with an unsuffixed English index.', deprecated: true })
});

export type AlgoliaConfiguration = z.infer<typeof AlgoliaConfigurationSchema>;
