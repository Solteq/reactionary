import * as z from 'zod';

export const AlgoliaConfigurationSchema = z.looseObject({
    appId: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
    useBaseIndexNameForEnglishLocale: z.boolean().default(true).meta({ description: 'Deprecated. When possible, move to all indexes with locale suffix. Whether to use the base name for the English locale. By default, this is enabled.', deprecated: true })
});

export type AlgoliaConfiguration = z.infer<typeof AlgoliaConfigurationSchema>;
