import * as z from 'zod';

export const MeilisearchConfigurationSchema = z.looseObject({
    apiUrl: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    orderIndexName: z.string(),
    useAIEmbedding: z.string().optional(),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
});

export type MeilisearchConfiguration = z.infer<typeof MeilisearchConfigurationSchema>;
