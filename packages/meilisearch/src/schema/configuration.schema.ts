import { SearchFacetPolicyOptionsSchema, SearchPersonalizationOptionsSchema } from '@reactionary/core';
import * as z from 'zod';

export const MeilisearchConfigurationSchema = z.looseObject({
    apiUrl: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
    orderIndexName: z.string(),
    useAIEmbedding: z.string().optional(),
    semanticRatio: z.number().default(0.5).meta({ description: 'The ratio of semantic relevance to keyword matching when using AI embeddings. This can be adjusted based on how much weight you want to give to semantic relevance vs keyword matching in search results.' }),
    facets: SearchFacetPolicyOptionsSchema.optional().meta({ description: 'Facet policy: facets to hide, names, order, multiselect attribute facets and the index fields behind price, rating, availability and taxonomy, on top of the defaults. Flags and the fields behind the typed facets are always hidden as attributes, productType.name is named "Product type".' }),
    personalization: SearchPersonalizationOptionsSchema.optional().meta({ description: 'Who personalizes a search for a visitor with a profile. "engine" (the default) sends the profile to Meilisearch as the user context of its personalization, which ranks with Cohere and needs the personalization API key of Meilisearch. "affinity" does not use the personalization of Meilisearch: Reactionary reorders the page Meilisearch returned by the interests of the visitor, starting from the ranking score of Meilisearch, within that page only, and Meilisearch is sent no personalization. "none" does neither. Only "affinity" has a "strength".' }),
    useRecommendationsForBots: z.boolean().default(false).meta({ description: 'Whether to use recommendations for bot traffic. By default, recommendations are not used for bots to save on API costs, but enabling this can provide a better experience for bot traffic such as search engine crawlers.' }),
});

export type MeilisearchConfiguration = z.infer<typeof MeilisearchConfigurationSchema>;
