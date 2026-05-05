import * as z from 'zod';

export const MeilisearchConfigurationSchema = z.looseObject({
    apiUrl: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    orderIndexName: z.string(),
    useAIEmbedding: z.string().optional(),
    semanticRatio: z.number().default(0.5).meta({ description: 'The ratio of semantic relevance to keyword matching when using AI embeddings. This can be adjusted based on how much weight you want to give to semantic relevance vs keyword matching in search results.' }),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
});

export type MeilisearchConfiguration = z.infer<typeof MeilisearchConfigurationSchema>;
