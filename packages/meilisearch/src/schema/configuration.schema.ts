import { SearchFacetPolicyOptionsSchema, SearchPersonalizationOptionsSchema } from '@reactionary/core';
import * as z from 'zod';

export const MeilisearchConfigurationSchema = z.looseObject({
    apiUrl: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    orderIndexName: z.string(),
    useAIEmbedding: z.string().optional(),
    semanticRatio: z.number().default(0.5).meta({ description: 'The ratio of semantic relevance to keyword matching when using AI embeddings. This can be adjusted based on how much weight you want to give to semantic relevance vs keyword matching in search results.' }),
    facets: SearchFacetPolicyOptionsSchema.optional().meta({ description: 'Facets to hide and facet names, on top of the defaults: flags and conceptIds are always hidden, productType.name is named "Product type" and concepts.<vocabulary> after the vocabulary.' }),
    personalization: SearchPersonalizationOptionsSchema.optional().meta({ description: 'Who personalizes a search for a visitor with a profile. "engine" (the default) sends the profile to Meilisearch as the user context of its personalization, which ranks with Cohere and needs the Meilisearch personalization API key. "affinity" reorders the page by the interests of the visitor in Reactionary and sends Meilisearch nothing. "none" does neither.' }),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
});

export type MeilisearchConfiguration = z.infer<typeof MeilisearchConfigurationSchema>;
